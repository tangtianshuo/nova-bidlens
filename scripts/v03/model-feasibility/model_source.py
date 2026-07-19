from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from huggingface_hub import snapshot_download

REQUIRED_ARTIFACTS = frozenset({
    "onnx/model.onnx_data",
    "onnx/sentencepiece.bpe.model",
    "onnx/tokenizer.json",
})


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_source(source: dict) -> None:
    if source.get("schemaVersion") != 1:
        raise ValueError("unsupported model source schema")
    revision = source.get("revision", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("revision must be a 40-character revision SHA")
    if source.get("expectedDimension") != 1024 or source.get("pooling") != "cls":
        raise ValueError("unexpected BGE-M3 embedding contract")
    artifacts = source.get("artifacts", [])
    if not artifacts:
        raise ValueError("artifact list must not be empty")
    provided_paths = {item["path"] for item in artifacts}
    if provided_paths != REQUIRED_ARTIFACTS:
        missing = REQUIRED_ARTIFACTS - provided_paths
        extra = provided_paths - REQUIRED_ARTIFACTS
        detail_parts = []
        if missing:
            detail_parts.append(f"missing={sorted(missing)}")
        if extra:
            detail_parts.append(f"extra={sorted(extra)}")
        raise ValueError(f"artifacts must match pinned set exactly; {', '.join(detail_parts)}")
    for artifact in artifacts:
        if not re.fullmatch(r"[0-9a-f]{64}", artifact.get("sha256", "")):
            raise ValueError(f"invalid SHA-256 for {artifact.get('path')}")


def acquire(source_path: Path, output_dir: Path) -> Path:
    source = json.loads(source_path.read_text("utf-8"))
    validate_source(source)
    snapshot = Path(snapshot_download(
        repo_id=source["modelId"],
        revision=source["revision"],
        local_dir=output_dir,
        allow_patterns=["onnx/*", "1_Pooling/config.json", "modules.json"],
    ))
    manifest = []
    expected = {item["path"]: item for item in source["artifacts"]}
    found: set[str] = set()
    for path in sorted(p for p in snapshot.rglob("*") if p.is_file()):
        relative = path.relative_to(snapshot).as_posix()
        if relative.startswith(".cache/"):
            continue
        digest = sha256_file(path)
        size = path.stat().st_size
        if relative in expected:
            found.add(relative)
            item = expected[relative]
            if digest != item["sha256"] or size != item["size"]:
                raise ValueError(f"artifact mismatch: {relative}")
        manifest.append({"path": relative, "sha256": digest, "size": size})
    missing = set(expected) - found
    if missing:
        raise ValueError(f"expected artifacts not downloaded: {sorted(missing)}")
    manifest_path = snapshot / "bidlens-source-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), "utf-8")
    return manifest_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(acquire(args.source, args.output))
