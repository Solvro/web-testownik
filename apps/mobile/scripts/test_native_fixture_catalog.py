"""No database/server: exercise bounded native catalog delays and compose safety."""

import json
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock

from django.conf import settings

if not settings.configured:
    settings.configure(DEFAULT_CHARSET="utf-8", USE_I18N=False, ALLOWED_HOSTS=["testserver"])

from django.http import HttpResponse
from django.test import RequestFactory
from native_fixture_controls import NativeComposeFaultMiddleware


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class TimedEvent(threading.Event):
    """Advance an injected clock rather than sleeping for the production lease."""

    def __init__(self, clock):
        super().__init__()
        self.clock = clock
        self.waits = []

    def wait(self, timeout=None):
        self.waits.append(timeout)
        self.clock.now += timeout
        return self.is_set()


class ObservedEvent(threading.Event):
    def __init__(self, waiters=1, after_release=None):
        super().__init__()
        self.expected = waiters
        self.entered = threading.Event()
        self.count = 0
        self.counter_lock = threading.Lock()
        self.after_release = after_release

    def wait(self, timeout=None):
        with self.counter_lock:
            self.count += 1
            if self.count == self.expected:
                self.entered.set()
        result = super().wait(timeout)
        if self.after_release is not None:
            if not self.after_release.wait(2):
                raise AssertionError("Test did not release the observed waiter")
        return result


class NativeCatalogControlTests(unittest.TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.downstream = Mock(side_effect=lambda _request: HttpResponse("Fixture catalog"))
        self.clock = Clock()

    def middleware(self, event_factory=threading.Event):
        return NativeComposeFaultMiddleware(
            self.downstream, _clock=self.clock, _event_factory=event_factory
        )

    def control(self, middleware, value=None, **headers):
        request = (
            self.factory.get("/__native_qa_control", REMOTE_ADDR="127.0.0.1", **headers)
            if value is None
            else self.factory.post(
                "/__native_qa_control", json.dumps(value), content_type="application/json",
                REMOTE_ADDR="127.0.0.1", **headers,
            )
        )
        return middleware(request)

    def state(self, middleware):
        return json.loads(self.control(middleware).content)

    def catalog(self, middleware):
        return middleware(self.factory.get("/api/ai/models/?native=fixture"))

    def test_default_constructor_accepts_hold_release_without_any_test_injection(self):
        middleware = NativeComposeFaultMiddleware(self.downstream)
        held = self.control(middleware, {"catalog": "hold"})
        self.assertEqual(held.status_code, 200)
        self.assertEqual(json.loads(held.content)["catalog"], "hold")
        released = self.control(middleware, {"catalog": "release"})
        self.assertEqual(released.status_code, 200)
        self.assertEqual(json.loads(released.content)["catalog"], "pass")
        self.downstream.assert_not_called()

    def test_default_pass_reports_no_waiters_and_only_exact_catalog_get_can_wait(self):
        event = TimedEvent(self.clock)
        middleware = self.middleware(lambda: event)
        self.assertEqual(self.state(middleware)["catalog"], "pass")
        self.assertEqual(self.catalog(middleware).status_code, 200)
        self.control(middleware, {"catalog": "hold"})
        for method, path in (
            ("get", "/api/user/"), ("get", "/api/ai/models/other/"),
            ("get", "/api/ai/models"), ("post", "/api/ai/models/"),
            ("options", "/api/ai/models/"),
        ):
            self.assertEqual(middleware(getattr(self.factory, method)(path)).status_code, 200)
        self.assertEqual(event.waits, [])
        state = self.state(middleware)
        self.assertEqual(state["catalog_waiting"], 0)
        self.assertEqual(state["catalog_started"], 0)

    def test_remaining_lease_timeout_never_forwards_or_releases_late(self):
        event = TimedEvent(self.clock)
        middleware = self.middleware(lambda: event)
        self.control(middleware, {"catalog": "hold"})
        self.clock.now += 15
        response = self.catalog(middleware)
        self.assertEqual(event.waits, [5.0])
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.downstream.assert_not_called()
        self.control(middleware, {"catalog": "release"})
        state = self.state(middleware)
        self.assertEqual(state["catalog"], "pass")
        self.assertEqual(state["catalog_waiting"], 0)
        self.assertEqual(state["catalog_timed_out"], 1)
        self.assertEqual(state["catalog_released"], 0)
        self.assertEqual(state["catalog_completed"], 0)

    def test_hold_without_waiter_expires_and_repeated_hold_never_renews_lease(self):
        middleware = self.middleware()
        first = json.loads(self.control(middleware, {"catalog": "hold"}).content)
        self.clock.now += 5
        repeated = json.loads(self.control(middleware, {"catalog": "hold"}).content)
        self.assertEqual(repeated["catalog_generation"], first["catalog_generation"])
        self.assertEqual(repeated["catalog_remaining_ms"], 15000)
        self.clock.now += 15
        expired = self.state(middleware)
        self.assertEqual(expired["catalog"], "pass")
        self.assertEqual(expired["catalog_timed_out"], 0)
        self.assertEqual(self.catalog(middleware).status_code, 200)
        fresh = json.loads(self.control(middleware, {"catalog": "hold"}).content)
        self.assertEqual(fresh["catalog_generation"], first["catalog_generation"] + 1)
        self.assertEqual(fresh["catalog_remaining_ms"], 20000)

    def test_first_arrival_after_expiry_passes_without_a_control_poll(self):
        middleware = self.middleware()
        self.control(middleware, {"catalog": "hold"})
        self.clock.now += 20
        self.assertEqual(self.catalog(middleware).status_code, 200)
        self.downstream.assert_called_once()
        state = self.state(middleware)
        self.assertEqual(state["catalog"], "pass")
        self.assertEqual(state["catalog_started"], 0)
        self.assertEqual(state["catalog_timed_out"], 0)

    def test_expired_old_waiter_cannot_clear_or_join_a_new_hold(self):
        return_gate = threading.Event()
        first = ObservedEvent(after_release=return_gate)
        next_event = ObservedEvent()
        events = iter([first, next_event])
        middleware = self.middleware(lambda: next(events))
        original = json.loads(self.control(middleware, {"catalog": "hold"}).content)
        with ThreadPoolExecutor(max_workers=1) as worker:
            future = worker.submit(self.catalog, middleware)
            try:
                self.assertTrue(first.entered.wait(1))
                self.clock.now += 20
                newer = json.loads(self.control(middleware, {"catalog": "hold"}).content)
                self.assertEqual(newer["catalog_generation"], original["catalog_generation"] + 1)
                return_gate.set()
                self.assertEqual(future.result(timeout=1).status_code, 503)
                state = self.state(middleware)
                self.assertEqual(state["catalog"], "hold")
                self.assertEqual(state["catalog_waiting"], 0)
                self.assertEqual(state["catalog_timed_out"], 1)
                self.assertEqual(state["catalog_released"], 0)
                self.assertFalse(next_event.entered.is_set())
            finally:
                return_gate.set()
                self.control(middleware, {"catalog": "release"})
        self.downstream.assert_not_called()

    def test_live_waiter_can_be_released_without_mutex_deadlock_and_response_is_not_cached(self):
        event = ObservedEvent()
        middleware = self.middleware(lambda: event)
        self.control(middleware, {"catalog": "hold"})
        with ThreadPoolExecutor(max_workers=1) as worker:
            future = worker.submit(self.catalog, middleware)
            try:
                self.assertTrue(event.entered.wait(1))
                state = self.state(middleware)
                self.assertEqual(state["catalog_waiting"], 1)
                self.assertFalse(future.done())
                self.control(middleware, {"catalog": "release"})
                response = future.result(timeout=1)
            finally:
                self.control(middleware, {"catalog": "release"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.downstream.assert_called_once()
        state = self.state(middleware)
        self.assertEqual(state["catalog_waiting"], 0)
        self.assertEqual(state["catalog_started"], 1)
        self.assertEqual(state["catalog_released"], 1)
        self.assertEqual(state["catalog_completed"], 1)

    def test_offline_before_wait_and_after_release_cannot_reach_downstream(self):
        event = ObservedEvent()
        middleware = self.middleware(lambda: event)
        self.control(middleware, {"catalog": "hold"})
        self.control(middleware, {"network": "offline"})
        self.assertEqual(self.catalog(middleware).status_code, 503)
        self.assertEqual(self.state(middleware)["catalog_started"], 0)
        self.control(middleware, {"network": "online"})
        with ThreadPoolExecutor(max_workers=1) as worker:
            future = worker.submit(self.catalog, middleware)
            try:
                self.assertTrue(event.entered.wait(1))
                self.control(middleware, {"network": "offline"})
                self.control(middleware, {"catalog": "release"})
                self.assertEqual(future.result(timeout=1).status_code, 503)
            finally:
                self.control(middleware, {"catalog": "release"})
        self.downstream.assert_not_called()
        state = self.state(middleware)
        self.assertEqual(state["blocked_requests"], 2)
        self.assertEqual(state["catalog_released"], 1)
        self.assertEqual(state["catalog_completed"], 0)
        self.assertEqual(state["catalog_waiting"], 0)

    def test_timeout_releases_parked_waiter_and_reset_does_not_hide_live_gauge(self):
        event = ObservedEvent()
        middleware = self.middleware(lambda: event)
        self.control(middleware, {"catalog": "hold"})
        with ThreadPoolExecutor(max_workers=1) as worker:
            future = worker.submit(self.catalog, middleware)
            try:
                self.assertTrue(event.entered.wait(1))
                reset = json.loads(self.control(middleware, {"mode": "reset"}).content)
                self.assertEqual(reset["catalog"], "hold")
                self.assertEqual(reset["catalog_waiting"], 1)
                self.clock.now += 20
                self.assertEqual(self.state(middleware)["catalog"], "pass")
                self.assertEqual(future.result(timeout=1).status_code, 503)
            finally:
                self.control(middleware, {"catalog": "release"})
        self.downstream.assert_not_called()
        state = self.state(middleware)
        self.assertEqual(state["catalog_waiting"], 0)
        self.assertEqual(state["catalog_timed_out"], 1)

    def test_release_and_new_hold_do_not_recapture_two_prior_waiters(self):
        return_gate = threading.Event()
        first = ObservedEvent(waiters=2, after_release=return_gate)
        next_event = ObservedEvent()
        events = iter([first, next_event])
        middleware = self.middleware(lambda: next(events))
        original = json.loads(self.control(middleware, {"catalog": "hold"}).content)
        with ThreadPoolExecutor(max_workers=2) as workers:
            futures = [workers.submit(self.catalog, middleware) for _ in range(2)]
            try:
                self.assertTrue(first.entered.wait(1))
                self.assertEqual(self.state(middleware)["catalog_waiting"], 2)
                self.control(middleware, {"catalog": "release"})
                newer = json.loads(self.control(middleware, {"catalog": "hold"}).content)
                self.assertEqual(newer["catalog_generation"], original["catalog_generation"] + 1)
                return_gate.set()
                self.assertEqual(
                    [future.result(timeout=1).status_code for future in futures],
                    [200, 200],
                )
                state = self.state(middleware)
                self.assertEqual(state["catalog"], "hold")
                self.assertEqual(state["catalog_waiting"], 0)
                self.assertEqual(state["catalog_released"], 2)
                self.assertEqual(state["catalog_completed"], 2)
                self.assertFalse(next_event.entered.is_set())
            finally:
                return_gate.set()
                self.control(middleware, {"catalog": "release"})
        self.assertEqual(self.downstream.call_count, 2)

    def test_bad_controls_cannot_alter_hold_or_enable_delivery(self):
        middleware = self.middleware()
        self.control(middleware, {"catalog": "hold"})
        for value in (
            {"catalog": "pass"}, {"catalog": []}, {"catalog": None},
            {"catalog": "hold", "network": "online"},
            {"catalog": "release", "mode": "reset"},
        ):
            self.assertEqual(self.control(middleware, value).status_code, 400)
        for headers in (
            {"HTTP_ORIGIN": "http://localhost"},
            {"HTTP_REFERER": "http://localhost/"},
        ):
            self.assertEqual(
                self.control(middleware, {"catalog": "release"}, **headers).status_code,
                403,
            )
        remote = self.factory.post(
            "/__native_qa_control", '{"catalog":"release"}',
            content_type="application/json", REMOTE_ADDR="192.0.2.1",
        )
        self.assertEqual(middleware(remote).status_code, 403)
        for raw in (
            '{"catalog":"hold","catalog":"release"}',
            '{"catalog":"release","mode":"reset"}',
            "{broken", b"\xff", b"x" * 257,
        ):
            request = self.factory.post(
                "/__native_qa_control", raw, content_type="application/json",
                REMOTE_ADDR="127.0.0.1",
            )
            self.assertEqual(middleware(request).status_code, 400)
        self.assertEqual(self.state(middleware)["catalog"], "hold")
        for route in NativeComposeFaultMiddleware.routes:
            self.assertEqual(middleware(self.factory.post(route, {})).status_code, 503)
        self.downstream.assert_not_called()
        self.assertTrue(self.state(middleware)["block_delivery"])

    def test_downstream_failure_never_leaks_live_waiter_or_claims_completion(self):
        event = ObservedEvent()
        middleware = self.middleware(lambda: event)
        self.downstream.side_effect = RuntimeError("Synthetic downstream failure")
        self.control(middleware, {"catalog": "hold"})
        with ThreadPoolExecutor(max_workers=1) as worker:
            future = worker.submit(self.catalog, middleware)
            try:
                self.assertTrue(event.entered.wait(1))
                self.control(middleware, {"catalog": "release"})
                with self.assertRaisesRegex(RuntimeError, "Synthetic downstream failure"):
                    future.result(timeout=1)
            finally:
                self.control(middleware, {"catalog": "release"})
        state = self.state(middleware)
        self.assertEqual(state["catalog_waiting"], 0)
        self.assertEqual(state["catalog_completed"], 0)


if __name__ == "__main__":
    unittest.main()
