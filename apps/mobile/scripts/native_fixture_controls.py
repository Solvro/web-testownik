"""Fail-closed controls installed only by the disposable native fixture runner."""

import json
import threading
import time
from dataclasses import dataclass
from typing import ClassVar

from django.http import JsonResponse


@dataclass
class CatalogHold:
    deadline: float
    event: threading.Event
    outcome: str | None = None


def unique_control_object(pairs):
    if len({key for key, _value in pairs}) != len(pairs):
        raise ValueError("Duplicate control key")
    return dict(pairs)


class NativeComposeFaultMiddleware:
    """Never deliver feedback/reports, even if control input is invalid."""

    routes: ClassVar[dict[str, str]] = {
        "/api/feedback/send": "feedback",
        "/api/feedback/send/": "feedback",
        "/api/report-question-issue": "report",
        "/api/report-question-issue/": "report",
    }

    catalog_lease_seconds = 20.0

    def __init__(
        self, get_response, *, _clock=time.monotonic, _event_factory=threading.Event
    ):
        self.get_response = get_response
        # Injection is for no-server unit tests, never a request/control option.
        self.clock = _clock
        self.event_factory = _event_factory
        self.lock = threading.Lock()
        self.intercepted = {"feedback": 0, "report": 0}
        self.offline = False
        self.media_requests = 0
        self.blocked_requests = 0
        self.catalog_hold = None
        self.catalog_generation = 0
        self.catalog_started = 0
        self.catalog_waiting = 0
        self.catalog_released = 0
        self.catalog_completed = 0
        self.catalog_timed_out = 0

    def expire_catalog_locked(self):
        hold = self.catalog_hold
        if hold is not None and self.clock() >= hold.deadline:
            hold.outcome = "timeout"
            self.catalog_hold = None
            hold.event.set()

    @staticmethod
    def unavailable(detail):
        response = JsonResponse({"detail": detail}, status=503)
        response["Cache-Control"] = "no-store"
        return response

    def wait_for_catalog(self):
        with self.lock:
            self.expire_catalog_locked()
            hold = self.catalog_hold
            if hold is None:
                return None
            self.catalog_started += 1
            self.catalog_waiting += 1
        try:
            while True:
                with self.lock:
                    remaining = hold.deadline - self.clock()
                    if hold.outcome is None and remaining <= 0:
                        hold.outcome = "timeout"
                        if self.catalog_hold is hold:
                            self.catalog_hold = None
                        hold.event.set()
                    if hold.outcome is not None:
                        if hold.outcome == "timeout":
                            self.catalog_timed_out += 1
                            return self.unavailable("Disposable native QA catalog delay expired.")
                        self.catalog_released += 1
                        # Connectivity may have changed while this thread waited.
                        if self.offline:
                            self.blocked_requests += 1
                            return self.unavailable("Disposable native QA transport unavailable.")
                        return True
                # Controls must remain available while a catalog request waits.
                hold.event.wait(remaining)
        finally:
            with self.lock:
                self.catalog_waiting -= 1

    def __call__(self, request):
        target = self.routes.get(request.path)
        if request.method == "POST" and target:
            with self.lock:
                self.intercepted[target] += 1
            # Always intercept before authentication, DB writes or transports.
            return JsonResponse(
                {"detail": "Disposable native QA service unavailable."}, status=503
            )
        if request.path != "/__native_qa_control":
            with self.lock:
                if request.path.startswith("/media/"):
                    self.media_requests += 1
                unavailable = self.offline and request.path.startswith(
                    ("/api/", "/media/")
                )
                if unavailable:
                    self.blocked_requests += 1
            if unavailable:
                return self.unavailable("Disposable native QA transport unavailable.")
            released = (
                self.wait_for_catalog()
                if request.method == "GET" and request.path == "/api/ai/models/"
                else None
            )
            if released is not None and released is not True:
                return released
            response = self.get_response(request)
            if released is True:
                with self.lock:
                    self.catalog_completed += 1
                response["Cache-Control"] = "no-store"
            return response
        if (
            request.META.get("REMOTE_ADDR") not in {"127.0.0.1", "::1"}
            or request.headers.get("Origin")
            or request.headers.get("Referer")
        ):
            return JsonResponse(
                {"detail": "Loopback native test control only."}, status=403
            )
        if request.method == "POST":
            if request.content_type != "application/json":
                return JsonResponse({"detail": "JSON control required."}, status=400)
            try:
                if len(request.body) > 256:
                    raise ValueError("Oversized control")
                value = json.loads(request.body, object_pairs_hook=unique_control_object)
                valid_mode = (
                    isinstance(value, dict)
                    and set(value) == {"mode"}
                    and isinstance(value["mode"], str)
                    and value["mode"] in {"compose-503", "reset"}
                )
                valid_network = (
                    isinstance(value, dict)
                    and set(value) == {"network"}
                    and isinstance(value["network"], str)
                    and value["network"] in {"online", "offline"}
                )
                valid_catalog = (
                    isinstance(value, dict)
                    and set(value) == {"catalog"}
                    and isinstance(value["catalog"], str)
                    and value["catalog"] in {"hold", "release"}
                )
                if not valid_mode and not valid_network and not valid_catalog:
                    raise ValueError("Invalid control")
            except (ValueError, UnicodeDecodeError):
                return JsonResponse(
                    {"detail": "Unknown native test control."}, status=400
                )
            with self.lock:
                self.expire_catalog_locked()
                if value.get("mode") == "reset":
                    self.intercepted = {"feedback": 0, "report": 0}
                    self.media_requests = 0
                    self.blocked_requests = 0
                if "network" in value:
                    self.offline = value["network"] == "offline"
                if value.get("catalog") == "hold" and self.catalog_hold is None:
                    self.catalog_generation += 1
                    self.catalog_hold = CatalogHold(
                        self.clock() + self.catalog_lease_seconds, self.event_factory()
                    )
                if value.get("catalog") == "release" and self.catalog_hold is not None:
                    hold = self.catalog_hold
                    self.catalog_hold = None
                    hold.outcome = "release"
                    hold.event.set()
        elif request.method != "GET":
            response = JsonResponse(
                {"detail": "Unsupported native test control method."}, status=405
            )
            response["Allow"] = "GET, POST"
            return response
        with self.lock:
            self.expire_catalog_locked()
            response = JsonResponse(
                {
                    "mode": "compose-503",
                    "block_delivery": True,
                    "network": "offline" if self.offline else "online",
                    "media_requests": self.media_requests,
                    "blocked_requests": self.blocked_requests,
                    "intercepted": dict(self.intercepted),
                    "catalog": "hold" if self.catalog_hold is not None else "pass",
                    "catalog_generation": self.catalog_generation,
                    "catalog_remaining_ms": (
                        max(0, round((self.catalog_hold.deadline - self.clock()) * 1000))
                        if self.catalog_hold is not None else 0
                    ),
                    # Lifetime counters survive reset; the live gauge must not
                    # disappear while a request from an earlier pulse is parked.
                    "catalog_started": self.catalog_started,
                    "catalog_waiting": self.catalog_waiting,
                    "catalog_released": self.catalog_released,
                    "catalog_completed": self.catalog_completed,
                    "catalog_timed_out": self.catalog_timed_out,
                }
            )
        response["Cache-Control"] = "no-store"
        return response
