"""No DB or transport: verify native compose controls cannot send anything."""

import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock

from django.conf import settings

if not settings.configured:
    settings.configure(
        DEFAULT_CHARSET="utf-8", USE_I18N=False, ALLOWED_HOSTS=["testserver"]
    )

from django.http import HttpResponse
from django.test import RequestFactory
from native_fixture_controls import NativeComposeFaultMiddleware


class NativeComposeControlTests(unittest.TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.downstream = Mock(return_value=HttpResponse("Unrelated disposable API"))
        self.middleware = NativeComposeFaultMiddleware(self.downstream)

    def control(self, method="get", data=None, **headers):
        request = getattr(self.factory, method)(
            "/__native_qa_control",
            data=data,
            content_type="application/json",
            REMOTE_ADDR="127.0.0.1",
            **headers,
        )
        return self.middleware(request)

    def assert_blocked(self):
        for route in NativeComposeFaultMiddleware.routes:
            with self.subTest(route=route):
                response = self.middleware(
                    self.factory.post(route, {"fixture": "Never deliver"})
                )
                self.assertEqual(response.status_code, 503)
        self.downstream.assert_not_called()

    def test_every_feedback_report_alias_is_always503_without_downstream(self):
        self.assert_blocked()
        result = json.loads(self.control().content)
        self.assertEqual(
            result,
            {
                "mode": "compose-503",
                "block_delivery": True,
                "network": "online",
                "media_requests": 0,
                "blocked_requests": 0,
                "intercepted": {"feedback": 2, "report": 2},
                "catalog": "pass",
                "catalog_generation": 0,
                "catalog_remaining_ms": 0,
                "catalog_started": 0,
                "catalog_waiting": 0,
                "catalog_released": 0,
                "catalog_completed": 0,
                "catalog_timed_out": 0,
            },
        )

    def test_query_and_unexpected_remote_address_cannot_bypass_delivery_block(self):
        for route in (
            "/api/feedback/send?fixture=1",
            "/api/report-question-issue/?fixture=1",
        ):
            response = self.middleware(
                self.factory.post(route, {}, REMOTE_ADDR="192.0.2.1")
            )
            self.assertEqual(response.status_code, 503)
        self.downstream.assert_not_called()

    def test_reset_counters_and_fail_mode_never_enable_delivery(self):
        self.assert_blocked()
        reset = self.control("post", '{"mode":"reset"}')
        self.assertEqual(reset.status_code, 200)
        self.assertEqual(
            json.loads(reset.content)["intercepted"], {"feedback": 0, "report": 0}
        )
        self.assertEqual(
            self.control("post", '{"mode":"compose-503"}').status_code, 200
        )
        self.assert_blocked()

    def test_invalid_control_modes_cannot_enable_delivery(self):
        for value in (
            None,
            [],
            "online",
            {},
            {"mode": "online"},
            {"mode": []},
            {"mode": {}},
            {"mode": "reset", "extra": 1},
            {"network": []},
            {"network": {}},
            {"network": "delivery"},
            {"network": "offline", "mode": "reset"},
        ):
            with self.subTest(value=value):
                self.assertEqual(
                    self.control("post", json.dumps(value)).status_code, 400
                )
        for raw in (b"{broken", b"\xff", b"x" * 257):
            self.assertEqual(self.control("post", raw).status_code, 400)
        self.assert_blocked()

    def test_control_denies_remote_origin_referer_and_preflight(self):
        for kwargs in (
            {"HTTP_ORIGIN": "http://localhost:8082"},
            {"HTTP_REFERER": "http://localhost:8082/"},
        ):
            self.assertEqual(self.control(**kwargs).status_code, 403)
        request = self.factory.get("/__native_qa_control", REMOTE_ADDR="192.0.2.1")
        self.assertEqual(self.middleware(request).status_code, 403)
        self.assertEqual(self.control("options").status_code, 405)
        self.assert_blocked()

    def test_control_requires_json_post_and_no_store(self):
        response = self.middleware(
            self.factory.post(
                "/__native_qa_control", {"mode": "reset"}, REMOTE_ADDR="127.0.0.1"
            )
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.control()["Cache-Control"], "no-store")
        self.downstream.assert_not_called()

    def test_unrelated_api_and_safe_get_continue_to_disposable_backend(self):
        for route in (
            "/api/user/",
            "/api/feedback/send",
            "/api/report-question-issue/",
        ):
            response = self.middleware(self.factory.get(route))
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.downstream.call_count, 3)

    def test_network_control_blocks_api_media_but_keeps_control_and_compose_safe(self):
        response = self.control("post", '{"network":"offline"}')
        self.assertEqual(response.status_code, 200)
        for route in (
            "/api/user/",
            "/api/quizzes/fixture/",
            "/media/native-qa/image.png",
        ):
            response = self.middleware(self.factory.get(route))
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response["Cache-Control"], "no-store")
        state = json.loads(self.control().content)
        self.assertTrue(state["block_delivery"])
        self.assertEqual(state["mode"], "compose-503")
        self.assertEqual(state["network"], "offline")
        self.assertEqual(state["media_requests"], 1)
        self.assertEqual(state["blocked_requests"], 3)
        self.assert_blocked()
        reset = json.loads(self.control("post", '{"mode":"reset"}').content)
        self.assertEqual(reset["network"], "offline")
        self.assertEqual(reset["blocked_requests"], 0)
        self.assertEqual(reset["media_requests"], 0)
        self.control("post", '{"network":"online"}')
        self.assert_blocked()
        response = self.middleware(self.factory.get("/media/native-qa/image.png"))
        self.assertEqual(response.status_code, 200)
        self.downstream.assert_called_once()

    def test_concurrent_faults_keep_exact_counter_without_delivery(self):
        def blocked(_index):
            return self.middleware(
                self.factory.post("/api/feedback/send", {})
            ).status_code

        with ThreadPoolExecutor(max_workers=4) as workers:
            self.assertEqual(list(workers.map(blocked, range(40))), [503] * 40)
        self.assertEqual(
            json.loads(self.control().content)["intercepted"]["feedback"], 40
        )
        self.downstream.assert_not_called()


if __name__ == "__main__":
    unittest.main()
