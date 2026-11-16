#!/usr/bin/env python3
"""Read-only, targeted byte checks for the synthetic native image fixture."""

import argparse
import hashlib
from pathlib import Path

from native_fixture_images import image_manifest, png_bytes


def check_cache(documents, manifest, phase):
    documents = Path(documents)
    if documents.is_symlink() or not documents.is_dir():
        raise ValueError("Expected an existing synthetic app Documents directory")
    if phase not in {"downloaded", "a-removed", "all-removed"}:
        raise ValueError("Unexpected cache verification phase")
    if set(manifest) != {"quizzes", "images"}:
        raise ValueError("Unexpected native image manifest")
    images = manifest["images"]
    if set(images) != {"shared", "unique"}:
        raise ValueError("Unexpected native image keys")
    folder = documents / "offline-images"
    if folder.is_symlink():
        raise ValueError("Symlinked image cache is not allowed")
    checked = []
    for key, shared in (("shared", True), ("unique", False)):
        spec = images[key]
        # Never trust a manifest to choose arbitrary filesystem paths.
        expected_name = (
            hashlib.sha256(spec["url"].encode("utf-16-be")).hexdigest() + ".png"
        )
        expected_hash = hashlib.sha256(png_bytes(shared)).hexdigest()
        if spec["cache_name"] != expected_name or spec["sha256"] != expected_hash:
            raise ValueError("Unexpected image URL key or byte hash")
        file = folder / expected_name
        expected_present = phase == "downloaded" or (phase == "a-removed" and shared)
        if file.is_symlink():
            raise ValueError("Symlinked cached image is not allowed")
        if expected_present:
            if (
                not file.is_file()
                or hashlib.sha256(file.read_bytes()).hexdigest() != expected_hash
            ):
                raise ValueError(f"Expected exact downloaded {key} PNG bytes")
        elif file.exists():
            raise ValueError(f"Expected removed {key} PNG")
        if folder.exists() and list(folder.glob(expected_name + ".*.partial")):
            raise ValueError(f"Unexpected remaining {key} partial download")
        checked.append(f"{key}:{'present' if expected_present else 'absent'}")
    return checked


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--documents", required=True)
    parser.add_argument("--api-port", type=int, default=8768)
    parser.add_argument(
        "--phase", choices=("downloaded", "a-removed", "all-removed"), required=True
    )
    args = parser.parse_args()
    result = check_cache(args.documents, image_manifest(args.api_port), args.phase)
    print("Native synthetic cache byte check PASS: " + ", ".join(result))
