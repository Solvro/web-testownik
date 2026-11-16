"""Additive, collision-refusing image fixtures for an explicitly disposable DB."""

import hashlib
import io
import os
import uuid
from pathlib import Path

from PIL import Image, ImageDraw

PREFIX = "e121bd54-80ab-4dce-8b4b-5aa4d1aa"
QUIZ_A = uuid.UUID(PREFIX + "0001")
QUIZ_B = uuid.UUID(PREFIX + "0002")
SHARED_IMAGE = uuid.UUID(PREFIX + "0031")
UNIQUE_IMAGE = uuid.UUID(PREFIX + "0032")


def png_bytes(shared):
    image = Image.new("RGB", (256, 144), "white")
    draw = ImageDraw.Draw(image)
    if shared:
        draw.rectangle((0, 0, 127, 143), fill="#dc2626")
        draw.rectangle((128, 0, 255, 143), fill="#06b6d4")
        draw.rectangle((36, 36, 219, 107), outline="white", width=8)
    else:
        draw.rectangle((0, 0, 255, 71), fill="#facc15")
        draw.rectangle((0, 72, 255, 143), fill="#18181b")
        draw.ellipse((76, 20, 179, 123), outline="#16a34a", width=10)
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False)
    return output.getvalue()


def image_manifest(api_port):
    result = {}
    for name, image_id, shared in (
        ("shared", SHARED_IMAGE, True),
        ("unique", UNIQUE_IMAGE, False),
    ):
        relative = f"native-qa/image-cache-{image_id}.png"
        url = f"http://127.0.0.1:{api_port}/media/{relative}"
        result[name] = {
            "id": str(image_id),
            "relative_path": relative,
            "url": url,
            "cache_name": hashlib.sha256(url.encode("utf-16-be")).hexdigest() + ".png",
            "sha256": hashlib.sha256(png_bytes(shared)).hexdigest(),
            "width": 256,
            "height": 144,
        }
    return {
        "quizzes": {
            "a": {
                "id": str(QUIZ_A),
                "title": "Native QA Image Cache A",
                "question_id": str(uuid.UUID(PREFIX + "0011")),
                "answer_ids": [
                    str(uuid.UUID(PREFIX + "0021")),
                    str(uuid.UUID(PREFIX + "0022")),
                ],
            },
            "b": {
                "id": str(QUIZ_B),
                "title": "Native QA Image Cache B",
                "question_id": str(uuid.UUID(PREFIX + "0012")),
                "answer_ids": [
                    str(uuid.UUID(PREFIX + "0023")),
                    str(uuid.UUID(PREFIX + "0024")),
                ],
            },
        },
        "images": result,
    }


def seed_images(media_root, api_port):
    # Import only after the caller validates the sentinel DB and local transports.
    from django.core.files.storage import default_storage
    from django.db import transaction
    from quizzes.models import Answer, Question, Quiz
    from uploads.models import UploadedImage
    from users.models import AccountType, User

    media_root = Path(media_root)
    storage = UploadedImage._meta.get_field("image").storage
    if (
        Path(default_storage.location).resolve() != media_root.resolve()
        or Path(storage.location).resolve() != media_root.resolve()
    ):
        raise RuntimeError(
            "Fixture image storage resolved outside disposable media root"
        )
    if media_root.is_symlink():
        raise RuntimeError("Symlinked fixture media root is not allowed")
    directory = media_root / "native-qa"
    if directory.is_symlink():
        raise RuntimeError("Symlinked fixture image directory is not allowed")
    manifest = image_manifest(api_port)
    with transaction.atomic():
        owner = User.objects.select_for_update().get(email="native-qa@example.invalid")
        if (
            owner.account_type == AccountType.GUEST
            or not owner.root_folder_id
            or not owner.is_active
            or owner.is_banned
        ):
            raise RuntimeError("Permanent synthetic fixture owner required")
        records = []
        for key, image_id, shared in (
            ("shared", SHARED_IMAGE, True),
            ("unique", UNIQUE_IMAGE, False),
        ):
            spec = manifest["images"][key]
            records.append(
                (
                    UploadedImage,
                    image_id,
                    {
                        "uploaded_by_id": owner.pk,
                        "image": spec["relative_path"],
                        "original_filename": f"native-qa-{key}.png",
                        "content_type": "image/png",
                        "file_size": len(png_bytes(shared)),
                        "width": 256,
                        "height": 144,
                    },
                )
            )
        for key, quiz_id, question_suffix in (
            ("a", QUIZ_A, "0011"),
            ("b", QUIZ_B, "0012"),
        ):
            question_id = uuid.UUID(PREFIX + question_suffix)
            records.append(
                (
                    Quiz,
                    quiz_id,
                    {
                        "creator_id": owner.pk,
                        "folder_id": owner.root_folder_id,
                        "title": manifest["quizzes"][key]["title"],
                        "description": None,
                        "visibility": 0,
                        "allow_anonymous": False,
                        "is_anonymous": False,
                        "is_ai_generated": False,
                        "version": 1,
                        "deleted_at": None,
                        "archived_at": None,
                    },
                )
            )
            records.append(
                (
                    Question,
                    question_id,
                    {
                        "quiz_id": quiz_id,
                        "order": 0,
                        "text": (
                            "Native cached question image.\n\n"
                            f"![Native markdown cache image]({manifest['images']['unique']['url']})"
                            if key == "a"
                            else "Native shared cached question image."
                        ),
                        "image_upload_id": SHARED_IMAGE,
                        "image_url": None,
                        "explanation": "",
                        "multiple": False,
                        "question_type": 0,
                        "tf_answer": None,
                        "is_ai_generated": False,
                        "is_flashcard": False,
                        "is_markdown_enabled": True,
                    },
                )
            )
            for index in range(2):
                answer_id = uuid.UUID(
                    PREFIX + str(21 + (0 if key == "a" else 2) + index).zfill(4)
                )
                records.append(
                    (
                        Answer,
                        answer_id,
                        {
                            "question_id": question_id,
                            "order": index,
                            "text": "Synthetic correct answer"
                            if index == 0
                            else "Synthetic other answer",
                            "is_correct": index == 0,
                            "image_url": None,
                            "image_upload_id": UNIQUE_IMAGE
                            if key == "a" and index == 0
                            else None,
                        },
                    )
                )
        # Refuse missing/extra children of a previous fixture; never restore edits.
        for quiz_id, question_suffix in ((QUIZ_A, "0011"), (QUIZ_B, "0012")):
            if Quiz.objects.filter(pk=quiz_id).exists():
                expected_question = uuid.UUID(PREFIX + question_suffix)
                if set(
                    Question.objects.filter(quiz_id=quiz_id).values_list(
                        "id", flat=True
                    )
                ) != {expected_question}:
                    raise RuntimeError(
                        "Existing fixture question collection changed; refusing overwrite"
                    )
                offset = 21 if quiz_id == QUIZ_A else 23
                expected_answers = {
                    uuid.UUID(PREFIX + str(offset + index).zfill(4))
                    for index in range(2)
                }
                if (
                    set(
                        Answer.objects.filter(
                            question_id=expected_question
                        ).values_list("id", flat=True)
                    )
                    != expected_answers
                ):
                    raise RuntimeError(
                        "Existing fixture answer collection changed; refusing overwrite"
                    )
        # Refuse collisions or edited previous fixtures before writing any rows/files.
        for model, key, expected in records:
            existing = model.objects.filter(pk=key).values(*expected).first()
            if existing is not None and existing != expected:
                raise RuntimeError(
                    "Existing fixture ID has different ownership or content; refusing overwrite"
                )
        for key, shared in (("shared", True), ("unique", False)):
            file = media_root / manifest["images"][key]["relative_path"]
            if (
                Path(storage.path(manifest["images"][key]["relative_path"])).resolve()
                != file.resolve()
            ):
                raise RuntimeError("Unexpected fixture storage file path")
            if file.is_symlink() or (
                file.exists() and file.read_bytes() != png_bytes(shared)
            ):
                raise RuntimeError(
                    "Existing fixture image bytes differ; refusing overwrite"
                )
        directory.mkdir(parents=True, exist_ok=True)
        for key, shared in (("shared", True), ("unique", False)):
            file = media_root / manifest["images"][key]["relative_path"]
            if not file.exists():
                fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "wb") as output:
                    output.write(png_bytes(shared))
        for model, key, expected in records:
            model.objects.get_or_create(pk=key, defaults=expected)
            if model.objects.filter(pk=key).values(*expected).get() != expected:
                raise RuntimeError(
                    "Fixture record changed during creation; refusing adoption"
                )
    return manifest
