import hashlib
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"
sys.path.insert(0, str(SCRIPT_DIR))

from model_source import sha256_file, validate_source


def test_sha256_file(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact.bin"
    artifact.write_bytes(b"bidlens")
    assert sha256_file(artifact) == hashlib.sha256(b"bidlens").hexdigest()


def test_validate_source_accepts_pinned_manifest() -> None:
    source = json.loads((SCRIPT_DIR / "model-source.json").read_text("utf-8"))
    validate_source(source)


def test_validate_source_rejects_moving_revision() -> None:
    source = json.loads((SCRIPT_DIR / "model-source.json").read_text("utf-8"))
    source["revision"] = "main"
    try:
        validate_source(source)
    except ValueError as error:
        assert "40-character revision" in str(error)
    else:
        raise AssertionError("moving revision was accepted")
