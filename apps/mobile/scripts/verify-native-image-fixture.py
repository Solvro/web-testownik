#!/usr/bin/env python3
"""Independent 8798/8799 rehearsal; never opens the active 8768 fixture DB."""

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from native_fixture_images import image_manifest

python = os.environ["MOBILE_E2E_PYTHON"]
backend = os.environ["MOBILE_E2E_BACKEND"]
scripts = Path(__file__).resolve().parent
fixture = scripts / "e2e-native-fixture.py"
runner = scripts / "run-native-fixture.cjs"
directory = Path(tempfile.mkdtemp(prefix="testownik-oauth-e2e-"))
(directory / ".disposable-mobile-e2e").write_text("")
os.chmod(directory / ".disposable-mobile-e2e", 0o600)
env = {
    **os.environ,
    "MOBILE_E2E_BACKEND": backend,
    "MOBILE_E2E_DB": str(directory / "db.sqlite3"),
    "MOBILE_E2E_API_PORT": "8798",
    "MOBILE_E2E_LOGIN_PORT": "8799",
}
api = "http://127.0.0.1:8798"
worker = None
log = None


def command(name, success=True):
    result = subprocess.run(
        [python, str(fixture), name],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if (result.returncode == 0) != success:
        raise RuntimeError(f"Unexpected disposable fixture {name} result")
    return result.stdout


def request(path, data=None, token=None):
    headers = {}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    query = urllib.request.Request(
        api + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(query, timeout=2) as result:
            return result.status, result.headers.get("Content-Type"), result.read()
    except urllib.error.HTTPError as result:
        return result.code, result.headers.get("Content-Type"), result.read()


def counts():
    with sqlite3.connect(directory / "db.sqlite3") as db:
        return {
            table: db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in (
                "users_user",
                "quizzes_quiz",
                "quizzes_question",
                "quizzes_answer",
                "uploads_uploadedimage",
            )
        }


try:
    command("init")
    before = counts()
    manifest = json.loads(command("seed-images"))
    assert manifest == image_manifest(8798)
    assert counts() == {
        **before,
        "quizzes_quiz": 2,
        "quizzes_question": 2,
        "quizzes_answer": 4,
        "uploads_uploadedimage": 2,
    }
    assert json.loads(command("seed-images")) == manifest
    assert len(list((directory / "media").rglob("*.png"))) == 2
    with sqlite3.connect(directory / "db.sqlite3") as db:
        db.execute(
            "UPDATE quizzes_quiz SET title='Changed synthetic fixture' WHERE id=?",
            (manifest["quizzes"]["a"]["id"].replace("-", ""),),
        )
    command("seed-images", success=False)
    with sqlite3.connect(directory / "db.sqlite3") as db:
        assert (
            db.execute(
                "SELECT title FROM quizzes_quiz WHERE id=?",
                (manifest["quizzes"]["a"]["id"].replace("-", ""),),
            ).fetchone()[0]
            == "Changed synthetic fixture"
        )
        db.execute(
            "UPDATE quizzes_quiz SET title=? WHERE id=?",
            (
                manifest["quizzes"]["a"]["title"],
                manifest["quizzes"]["a"]["id"].replace("-", ""),
            ),
        )
        owner = db.execute(
            "SELECT id FROM users_user WHERE email='native-qa@example.invalid'"
        ).fetchone()[0]
        db.execute(
            "UPDATE uploads_uploadedimage SET uploaded_by_id=NULL WHERE id=?",
            (manifest["images"]["shared"]["id"].replace("-", ""),),
        )
    command("seed-images", success=False)
    with sqlite3.connect(directory / "db.sqlite3") as db:
        assert (
            db.execute(
                "SELECT uploaded_by_id FROM uploads_uploadedimage WHERE id=?",
                (manifest["images"]["shared"]["id"].replace("-", ""),),
            ).fetchone()[0]
            is None
        )
        db.execute(
            "UPDATE uploads_uploadedimage SET uploaded_by_id=? WHERE id=?",
            (owner, manifest["images"]["shared"]["id"].replace("-", "")),
        )
    assert json.loads(command("seed-images")) == manifest
    a_question_id = manifest["quizzes"]["a"]["question_id"].replace("-", "")
    with sqlite3.connect(directory / "db.sqlite3") as db:
        db.execute(
            "UPDATE quizzes_question SET explanation='Edited fixture explanation' WHERE id=?",
            (a_question_id,),
        )
    command("seed-images", success=False)
    with sqlite3.connect(directory / "db.sqlite3") as db:
        assert (
            db.execute(
                "SELECT explanation FROM quizzes_question WHERE id=?", (a_question_id,)
            ).fetchone()[0]
            == "Edited fixture explanation"
        )
        db.execute(
            "UPDATE quizzes_question SET explanation='',quiz_id=? WHERE id=?",
            (manifest["quizzes"]["b"]["id"].replace("-", ""), a_question_id),
        )
    command("seed-images", success=False)
    with sqlite3.connect(directory / "db.sqlite3") as db:
        assert db.execute(
            "SELECT quiz_id FROM quizzes_question WHERE id=?", (a_question_id,)
        ).fetchone()[0] == manifest["quizzes"]["b"]["id"].replace("-", "")
        db.execute(
            "UPDATE quizzes_question SET quiz_id=? WHERE id=?",
            (manifest["quizzes"]["a"]["id"].replace("-", ""), a_question_id),
        )
    assert json.loads(command("seed-images")) == manifest
    shared_file = directory / "media" / manifest["images"]["shared"]["relative_path"]
    original_bytes = shared_file.read_bytes()
    shared_file.write_bytes(b"Changed synthetic bytes")
    command("seed-images", success=False)
    assert shared_file.read_bytes() == b"Changed synthetic bytes"
    shared_file.write_bytes(original_bytes)
    assert json.loads(command("seed-images")) == manifest
    moved_file = directory / "preserved-synthetic.png"
    shared_file.rename(moved_file)
    shared_file.symlink_to(moved_file)
    command("seed-images", success=False)
    assert shared_file.is_symlink() and moved_file.read_bytes() == original_bytes
    shared_file.unlink()
    moved_file.rename(shared_file)
    assert json.loads(command("seed-images")) == manifest
    log = (directory / "rehearsal.log").open("w")
    subprocess.run(
        ["node", str(runner), "--resume", str(directory), "--verify"],
        env=env,
        stdout=log,
        stderr=log,
        check=True,
    )
    worker = subprocess.Popen(
        ["node", str(runner), "--resume", str(directory)],
        env=env,
        stdout=log,
        stderr=log,
    )
    for _attempt in range(100):
        if worker.poll() is not None:
            raise RuntimeError("Independent native fixture exited")
        try:
            status, _, data = request("/__native_qa_control")
            if status == 200 and json.loads(data)["block_delivery"] is True:
                break
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(0.1)
    else:
        raise RuntimeError("Independent native fixture readiness timed out")
    for spec in manifest["images"].values():
        status, content_type, data = request(spec["url"].removeprefix(api))
        assert status == 200 and content_type == "image/png"
        assert hashlib.sha256(data).hexdigest() == spec["sha256"]
    with sqlite3.connect(directory / "db.sqlite3") as db:
        token = db.execute(
            "SELECT token FROM oauth2_provider_accesstoken ORDER BY id DESC LIMIT 1"
        ).fetchone()[0]
    status, _, data = request(
        "/api/quizzes/"
        + manifest["quizzes"]["a"]["id"]
        + "/?include=user_settings,current_session",
        token=token,
    )
    assert status == 200
    quiz = json.loads(data)
    assert quiz["questions"][0]["id"] == manifest["quizzes"]["a"]["question_id"]
    assert [answer["id"] for answer in quiz["questions"][0]["answers"]] == manifest[
        "quizzes"
    ]["a"]["answer_ids"]
    assert quiz["questions"][0]["image"] == manifest["images"]["shared"]["url"]
    assert (
        quiz["questions"][0]["answers"][0]["image"]
        == manifest["images"]["unique"]["url"]
    )
    assert manifest["images"]["unique"]["url"] in quiz["questions"][0]["text"]
    status, _, data = request(
        "/api/quizzes/" + manifest["quizzes"]["b"]["id"] + "/",
        token=token,
    )
    assert status == 200
    quiz_b = json.loads(data)
    assert quiz_b["questions"][0]["id"] == manifest["quizzes"]["b"]["question_id"]
    assert quiz_b["questions"][0]["image"] == manifest["images"]["shared"]["url"]
    assert [answer["id"] for answer in quiz_b["questions"][0]["answers"]] == manifest[
        "quizzes"
    ]["b"]["answer_ids"]
    assert all(not answer["image"] for answer in quiz_b["questions"][0]["answers"])
    status, _, data = request("/__native_qa_control", {"network": "offline"})
    assert status == 200 and json.loads(data)["network"] == "offline"
    for path in (
        "/api/user/",
        "/api/quizzes/" + manifest["quizzes"]["a"]["id"] + "/",
        *(spec["url"].removeprefix(api) for spec in manifest["images"].values()),
    ):
        assert request(path)[0] == 503
    for path in ("/api/feedback/send", "/api/report-question-issue/"):
        assert request(path, {})[0] == 503
    control = json.loads(request("/__native_qa_control")[2])
    assert (
        control["block_delivery"] is True
        and control["mode"] == "compose-503"
        and control["blocked_requests"] == 4
    )
    assert request("/__native_qa_control", {"network": "online"})[0] == 200
    assert request("/api/feedback/send", {})[0] == 503
    assert request("/api/user/", token=token)[0] == 200
    print(
        "Native image fixture rehearsal PASS: additive seed/replay/collision refusal, exact media bytes and authenticated URLs, API/media outage, immutable compose block, recovery."
    )
finally:
    if worker is not None:
        worker.terminate()
        try:
            worker.wait(timeout=10)
        except subprocess.TimeoutExpired:
            worker.kill()
            worker.wait(timeout=5)
    if log is not None:
        log.close()
    shutil.rmtree(directory)
