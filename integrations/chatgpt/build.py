"""Validate the public package files and build a credential-free draft ZIP."""

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / "plugin"


def build(require_ready=False):
    manifest = json.loads((PACKAGE / "plugin.json").read_text())
    mcp = json.loads((PACKAGE / "mcp.json").read_text())
    extension = manifest["extensions"]["com.openai"]
    listing = extension["interface"]
    review = extension["review"]
    for field, limit in [("displayName", 30), ("shortDescription", 30), ("longDescription", 4000)]:
        assert 0 < len(listing[field]) <= limit, field
    assert len(listing["defaultPrompt"]) <= 3
    assert all(0 < len(prompt) <= 128 for prompt in listing["defaultPrompt"])
    for field in ["websiteURL", "supportURL", "privacyPolicyURL"]:
        url = urlparse(listing[field])
        assert url.scheme == "https" and url.netloc and not url.username, field
    assets = set()
    for field in ["logo", "logoDark", "composerIcon", "composerIconDark"]:
        relative = listing[field]
        assert relative.startswith("./assets/") and ".." not in Path(relative).parts
        path = PACKAGE / relative
        assert path.is_file() and path.stat().st_size <= 5 * 1024 * 1024
        icon = ElementTree.parse(path).getroot()
        _, _, width, height = map(float, icon.attrib["viewBox"].split())
        assert width == height and width >= 48
        assets.add(path)
    cases = review["test_cases"]
    assert len(cases["positive"]) == 5 and len(cases["negative"]) == 3
    for kind, items in cases.items():
        for case in items:
            assert case["description"] and case["prompt"] and case["expected_behavior"]
            if kind == "positive":
                assert case["tools_triggered"]
    server = mcp["mcpServers"]["testownik"]
    assert server["type"] == "streamable-http"
    assert server["url"] == "https://testownik.solvro.pl/api/mcp"
    auth = server["extensions"]["com.openai"]["auth"]
    assert auth["type"] == "oauth" and auth["client"]["mode"] == "cimd"
    assert not server.get("headers")
    forbidden = {"clientSecret", "test_credentials", "reviewer_instructions", "access_token", "refresh_token"}

    def check_keys(value):
        if isinstance(value, dict):
            assert forbidden.isdisjoint(value), "Credentials must stay outside the public package"
            for child in value.values():
                check_keys(child)
        elif isinstance(value, list):
            for child in value:
                check_keys(child)

    check_keys(manifest)
    check_keys(mcp)
    missing = []
    if not listing.get("termsOfServiceURL"):
        missing.append("published Terms of Service URL")
    if not review.get("demo_recording_url"):
        missing.append("reviewer-accessible walkthrough recording URL")
    if require_ready and missing:
        sys.exit("Review metadata incomplete: " + "; ".join(missing))
    output = ROOT / "dist" / f"testownik-{manifest['version']}.zip"
    output.parent.mkdir(exist_ok=True)
    files = [PACKAGE / "plugin.json", PACKAGE / "mcp.json", *sorted(assets)]
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(PACKAGE))
    print(f"Built {output} ({len(files)} public files)")
    if missing:
        print("DRAFT ONLY. Missing review metadata: " + "; ".join(missing))
    print("Portal identity/domain verification, reviewer access, live testing, and approval are separate requirements.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-ready", action="store_true", help="Reject missing review metadata before building")
    build(parser.parse_args().require_ready)
