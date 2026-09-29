#!/usr/bin/env python3
"""Loopback-only fault injection for native tests against a disposable API.

Start with `python3 scripts/native-api-proxy.py` and point Metro's public API URL
at http://127.0.0.1:8767/api. No request headers, tokens or bodies are logged.
The control endpoint is for the native test runner, never part of the app.
"""
import http.client
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

lock = threading.Lock()
state = {"offline": False, "answers_forwarded": 0, "answers_succeeded": 0}


class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def handle_request(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        if self.path == "/__control":
            if self.command == "POST":
                try:
                    mode = json.loads(body)["mode"]
                    if mode not in ("offline", "online", "reset"):
                        raise ValueError("Unknown mode")
                except (ValueError, KeyError):
                    self.send_error(400)
                    return
                with lock:
                    state["offline"] = mode == "offline"
                    if mode == "reset":
                        state.update(answers_forwarded=0, answers_succeeded=0)
            with lock:
                result = json.dumps(state).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(result)))
            self.end_headers()
            self.wfile.write(result)
            return
        if not self.path.startswith("/api/"):
            self.send_error(404)
            return
        with lock:
            offline = state["offline"]
        if offline:
            self.close_connection = True
            self.connection.shutdown(socket.SHUT_RDWR)
            return
        answer = self.command == "POST" and self.path.startswith("/api/mobile/quizzes/") and self.path.endswith("/answer/")
        if answer:
            with lock:
                state["answers_forwarded"] += 1
        headers = {key: value for key, value in self.headers.items()
                   if key.lower() not in ("host", "connection", "content-length")}
        upstream = http.client.HTTPConnection("127.0.0.1", 8765, timeout=20)
        try:
            upstream.request(self.command, self.path, body=body, headers=headers)
            response = upstream.getresponse()
            data = response.read()
            if answer and 200 <= response.status < 300:
                with lock:
                    state["answers_succeeded"] += 1
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in ("connection", "transfer-encoding", "content-length"):
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (OSError, http.client.HTTPException):
            self.close_connection = True
        finally:
            upstream.close()

    do_GET = do_POST = do_PATCH = do_DELETE = do_OPTIONS = handle_request


if __name__ == "__main__":
    print("Native test proxy: 127.0.0.1:8767 -> disposable API 127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8767), Proxy).serve_forever()
