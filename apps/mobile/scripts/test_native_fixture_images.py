"""Pure raster/URL-key and targeted native filesystem-checker regressions."""

import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

from native_fixture_images import image_manifest, png_bytes
from PIL import Image

module = importlib.util.spec_from_file_location(
    "native_cache_checker", Path(__file__).with_name("check-native-image-cache.py")
)
checker = importlib.util.module_from_spec(module)
module.loader.exec_module(checker)


class NativeFixtureImageTests(unittest.TestCase):
    def test_pngs_are_distinct_deterministic_visible_rgb_images(self):
        self.assertNotEqual(png_bytes(True), png_bytes(False))
        for shared in (True, False):
            self.assertEqual(png_bytes(shared), png_bytes(shared))
            with Image.open(io.BytesIO(png_bytes(shared))) as image:
                self.assertEqual(image.size, (256, 144))
                self.assertEqual(image.mode, "RGB")
                self.assertGreater(len(image.getcolors()), 1)

    def test_url_cache_names_change_with_port_and_images_share_only_one_key(self):
        default = image_manifest(8768)
        isolated = image_manifest(8798)
        self.assertEqual(default["quizzes"], isolated["quizzes"])
        for key in ("shared", "unique"):
            self.assertNotEqual(
                default["images"][key]["cache_name"],
                isolated["images"][key]["cache_name"],
            )
            self.assertEqual(
                default["images"][key]["sha256"], isolated["images"][key]["sha256"]
            )

    def test_checker_reads_exact_files_and_removal_preserves_shared_reference(self):
        manifest = image_manifest(8768)
        with tempfile.TemporaryDirectory(prefix="testownik-image-check-") as directory:
            folder = Path(directory) / "offline-images"
            folder.mkdir()
            for key, shared in (("shared", True), ("unique", False)):
                (folder / manifest["images"][key]["cache_name"]).write_bytes(
                    png_bytes(shared)
                )
            self.assertEqual(
                checker.check_cache(directory, manifest, "downloaded"),
                ["shared:present", "unique:present"],
            )
            (folder / manifest["images"]["unique"]["cache_name"]).unlink()
            checker.check_cache(directory, manifest, "a-removed")
            (folder / manifest["images"]["shared"]["cache_name"]).unlink()
            checker.check_cache(directory, manifest, "all-removed")

    def test_checker_rejects_missing_changed_partial_and_symlinked_bytes(self):
        manifest = image_manifest(8768)
        with tempfile.TemporaryDirectory(prefix="testownik-image-check-") as directory:
            folder = Path(directory) / "offline-images"
            folder.mkdir()
            with self.assertRaises(ValueError):
                checker.check_cache(directory, manifest, "downloaded")

            shared = folder / manifest["images"]["shared"]["cache_name"]
            unique = folder / manifest["images"]["unique"]["cache_name"]
            shared.write_bytes(png_bytes(True))
            unique.write_bytes(b"wrong bytes")
            with self.assertRaises(ValueError):
                checker.check_cache(directory, manifest, "downloaded")

            unique.write_bytes(png_bytes(False))
            partial = Path(str(unique) + ".1.partial")
            partial.write_bytes(b"incomplete")
            with self.assertRaises(ValueError):
                checker.check_cache(directory, manifest, "downloaded")
            partial.unlink()
            unique.unlink()
            unique.symlink_to(shared)
            with self.assertRaises(ValueError):
                checker.check_cache(directory, manifest, "downloaded")

    def test_checker_refuses_wrong_container_even_when_checking_removal(self):
        with (
            tempfile.TemporaryDirectory(prefix="testownik-image-check-") as directory,
            self.assertRaises(ValueError),
        ):
            checker.check_cache(
                Path(directory) / "missing", image_manifest(8768), "all-removed"
            )
