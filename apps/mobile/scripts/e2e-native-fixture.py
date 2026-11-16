#!/usr/bin/env python3
"""Disposable native OAuth fixture; never reads a developer's database or tokens.

Create a tempfile directory named testownik-oauth-e2e-* with a
.disposable-mobile-e2e sentinel, then set MOBILE_E2E_BACKEND and MOBILE_E2E_DB.
Commands: init, seed-images, api (8768), login (8769). The login server approves only the
registered first-party mobile app as a synthetic local user, using the real
authorization-code/PKCE endpoint. No emails or provider requests are sent.
"""

import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def fixture_port(name, fallback):
    value = os.environ.get(name, str(fallback))
    if not value.isascii() or not value.isdecimal() or not 1024 <= int(value) <= 65535:
        raise RuntimeError("Native fixture ports must be unprivileged numeric ports")
    return int(value)


api_port = fixture_port("MOBILE_E2E_API_PORT", 8768)
login_port = fixture_port("MOBILE_E2E_LOGIN_PORT", 8769)
if api_port == login_port:
    raise RuntimeError("Native fixture ports must differ")
backend = Path(os.environ["MOBILE_E2E_BACKEND"]).resolve()
database_input = Path(os.environ["MOBILE_E2E_DB"])
if database_input.is_symlink() or database_input.parent.is_symlink():
    raise RuntimeError("Symlinked fixture database is not allowed")
database = database_input.resolve()
if (
    database.name != "db.sqlite3"
    or not database.parent.name.startswith("testownik-oauth-e2e-")
    or database.parent.parent != Path(tempfile.gettempdir()).resolve()
    or not (database.parent / ".disposable-mobile-e2e").is_file()
):
    raise RuntimeError("An explicitly disposable E2E database is required")
if sys.argv[1:] not in (["init"], ["seed-images"], ["api"], ["login"]):
    raise RuntimeError("Choose init, seed-images, api, or login")
os.environ.update(
    DJANGO_SETTINGS_MODULE="mobile_api.test_settings",
    MOBILE_TEST_DB=str(database),
    DEBUG="True",
    SECRET_KEY="disposable-native-e2e-only",
    JWT_SECRET="disposable-native-e2e-only",
    PYTHON_DOTENV_DISABLED="1",
    S3_BUCKET_NAME="",
    INTERNAL_API_KEY="",
    USOS_CONSUMER_KEY="",
    USOS_CONSUMER_SECRET="",
    SOLVRO_AUTH_CLIENT_ID="",
    SOLVRO_AUTH_CLIENT_SECRET="",
    OPENAI_API_KEY="",
)
sys.path.insert(0, str(backend))

import django  # noqa: E402
from django.conf import settings  # noqa: E402

# Configure before app setup can instantiate storage or import the URLconf.
settings.MEDIA_ROOT = database.parent / "media"
django.setup()
from django.core.management import call_command  # noqa: E402
from django.db import close_old_connections  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402
from users.models import User  # noqa: E402

if Path(settings.DATABASES["default"]["NAME"]).resolve() != database:
    raise RuntimeError("Unexpected fixture database")
if settings.EMAIL_BACKEND != "django.core.mail.backends.locmem.EmailBackend":
    raise RuntimeError("Fixture email must stay local")
if (
    settings.STORAGES["default"]["BACKEND"]
    != "django.core.files.storage.FileSystemStorage"
):
    raise RuntimeError("Fixture uploads must stay local")
email = "native-qa@example.invalid"

if sys.argv[1] == "init":
    call_command("migrate", verbosity=0)
    call_command("register_mobile_oauth", verbosity=0)
    if not User.objects.filter(email=email).exists():
        User.objects.create_user(
            email=email, password=None, first_name="Disposable", last_name="Native QA"
        )
    print("Initialized disposable native QA database.")
elif sys.argv[1] == "seed-images":
    import json

    from native_fixture_images import seed_images

    print(json.dumps(seed_images(settings.MEDIA_ROOT, api_port), indent=2))
elif sys.argv[1] == "api":
    # Installed only after the explicit disposable DB and local transport checks.
    # These routes NEVER reach notification code; the native runner may press Send.
    settings.MIDDLEWARE = [
        "native_fixture_controls.NativeComposeFaultMiddleware",
        *settings.MIDDLEWARE,
    ]
    call_command(
        "runserver", f"127.0.0.1:{api_port}", use_reloader=False, use_threading=True
    )
else:

    class LoginHandler(BaseHTTPRequestHandler):
        timeout = 10

        def log_message(self, _format, *_args):
            # Authorization codes and callback URLs must never enter logs.
            pass

        def do_GET(self):
            parsed = urlparse(self.path)
            values = parse_qs(parsed.query)
            params = {key: value[0] for key, value in values.items() if len(value) == 1}
            allowed = (
                parsed.path == "/oauth/authorize"
                and params.get("client_id") == "testownik-mobile"
                and params.get("redirect_uri") == "testownik://auth"
                and params.get("response_type") == "code"
                and params.get("code_challenge_method") == "S256"
                and bool(params.get("state"))
                and bool(params.get("code_challenge"))
                and set(params.get("scope", "").split())
                == {
                    "quizzes:read",
                    "quizzes:write",
                    "study:read",
                    "study:write",
                    "user:read",
                    "user:write",
                    "grades:read",
                    "notifications:read",
                    "notifications:write",
                    "feedback:write",
                    "ai:read",
                    "ai:write",
                    "web:read",
                }
            )
            if not allowed:
                self.send_error(404, "Disposable OAuth fixture only")
                return
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(email=email))
                response = client.post(
                    "/api/oauth/authorize/request/",
                    {
                        "authorization_params": params,
                        "scopes": params.get("scope", "").split(),
                        "allow": True,
                    },
                    format="json",
                )
                if response.status_code != 200:
                    self.send_error(400, "Disposable authorization failed")
                    return
                destination = response.data.get("redirect_url", "")
                if not destination.startswith("testownik://auth?"):
                    self.send_error(400, "Unexpected fixture callback")
                    return
                self.send_response(302)
                self.send_header("Location", destination)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Referrer-Policy", "no-referrer")
                self.end_headers()
            finally:
                close_old_connections()

    print(
        f"Disposable native OAuth issuer listening on loopback port{login_port}.",
        flush=True,
    )
    ThreadingHTTPServer(("127.0.0.1", login_port), LoginHandler).serve_forever()
