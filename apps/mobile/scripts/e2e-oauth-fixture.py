#!/usr/bin/env python3
# ruff: noqa: E402 -- configure isolated Django settings before importing models
"""Issue an opaque OAuth fixture only inside an explicitly isolated E2E database.

MOBILE_E2E_BACKEND names the backend checkout. MOBILE_E2E_DB must be inside a
fresh tempfile.mkdtemp(prefix='testownik-oauth-e2e-') directory. Never points at
the signed-in simulator's database. Prints fixture tokens to the caller only.
"""

import json
import os
import secrets
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

backend = Path(os.environ["MOBILE_E2E_BACKEND"]).resolve()
database = Path(os.environ["MOBILE_E2E_DB"])
if database.is_symlink() or database.parent.is_symlink():
    raise RuntimeError("Symlinked fixture database is not allowed")
database = database.resolve()
if (
    database.name != "db.sqlite3"
    or not database.parent.name.startswith("testownik-oauth-e2e-")
    or database.parent.parent != Path(tempfile.gettempdir()).resolve()
    or not (database.parent / ".disposable-mobile-e2e").is_file()
):
    raise RuntimeError("An explicitly disposable E2E database is required")
os.environ.update(
    DJANGO_SETTINGS_MODULE="mobile_api.test_settings",
    MOBILE_TEST_DB=str(database),
    DEBUG="True",
    SECRET_KEY="disposable-mobile-e2e-only",
    JWT_SECRET="disposable-mobile-e2e-only",
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
import django

django.setup()
from django.conf import settings
from django.core.management import call_command
from django.utils import timezone
from oauth2_provider.models import AccessToken, RefreshToken, get_application_model
from users.models import User

settings.MEDIA_ROOT = database.parent / "media"

if Path(settings.DATABASES["default"]["NAME"]).resolve() != database:
    raise RuntimeError("Unexpected fixture database")
if settings.STORAGES["default"]["BACKEND"] != "django.core.files.storage.FileSystemStorage":
    raise RuntimeError("Fixture uploads must stay local")
if settings.EMAIL_BACKEND != "django.core.mail.backends.locmem.EmailBackend":
    raise RuntimeError("Fixture email must stay local")
if sys.argv[1:] == ["migrate"]:
    call_command("migrate", verbosity=0)
    call_command("register_mobile_oauth", verbosity=0)
elif sys.argv[1:] == ["serve"]:
    call_command("runserver", "127.0.0.1:8768", use_reloader=False)
else:
    user = User.objects.create_user(email=f"e2e-{secrets.token_hex(12)}@example.invalid", password=None)
    app = get_application_model().objects.get(client_id="testownik-mobile")
    access = AccessToken.objects.create(
        user=user,
        application=app,
        token=secrets.token_urlsafe(32),
        expires=timezone.now() + timedelta(hours=1),
        scope=(
            "quizzes:read quizzes:write study:read study:write user:read user:write "
            "grades:read notifications:read notifications:write feedback:write ai:read ai:write web:read"
        ),
    )
    refresh = RefreshToken.objects.create(
        user=user, application=app, token=secrets.token_urlsafe(32), access_token=access
    )
    print(json.dumps({"access": access.token, "refresh": refresh.token}))
