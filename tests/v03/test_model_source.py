import hashlib
import json
import sys
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"
sys.path.insert(0, str(SCRIPT_DIR))

from model_source import REQUIRED_ARTIFACTS, sha256_file, validate_source


def _valid_source() -> dict:
    return json.loads((SCRIPT_DIR / "model-source.json").read_text("utf-8"))


def test_sha256_file(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact.bin"
    artifact.write_bytes(b"bidlens")
    assert sha256_file(artifact) == hashlib.sha256(b"bidlens").hexdigest()


def test_validate_source_accepts_pinned_manifest() -> None:
    validate_source(_valid_source())


def test_validate_source_rejects_moving_revision() -> None:
    source = _valid_source()
    source["revision"] = "main"
    with pytest.raises(ValueError, match="40-character revision"):
        validate_source(source)


def test_validate_source_rejects_empty_artifacts() -> None:
    source = _valid_source()
    source["artifacts"] = []
    with pytest.raises(ValueError, match="must not be empty"):
        validate_source(source)


def test_validate_source_rejects_missing_artifacts() -> None:
    source = _valid_source()
    source["artifacts"] = [a for a in source["artifacts"] if a["path"] != "onnx/tokenizer.json"]
    with pytest.raises(ValueError, match="artifacts must match pinned set exactly"):
        validate_source(source)


def test_validate_source_rejects_extra_artifacts() -> None:
    source = _valid_source()
    source["artifacts"] = list(source["artifacts"]) + [
        {"path": "onnx/extra.bin", "sha256": "aa" * 32, "size": 100}
    ]
    with pytest.raises(ValueError, match="artifacts must match pinned set exactly"):
        validate_source(source)
