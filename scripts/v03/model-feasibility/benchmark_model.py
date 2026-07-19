from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import psutil
from transformers import AutoTokenizer

SENTENCES = [
    "投标人应具有建筑工程施工总承包一级资质。",
    "申请人须具备建筑工程施工总承包壹级资格。",
    "投标保证金为人民币五十万元。",
    "本项目不要求提交投标保证金。",
]


def normalize(values: np.ndarray) -> np.ndarray:
    denominator = np.linalg.norm(values, axis=1, keepdims=True)
    if np.any(denominator == 0) or not np.isfinite(denominator).all():
        raise ValueError("invalid embedding norm")
    return values / denominator


def ort_embeddings(model_path: Path, encoded) -> np.ndarray:
    options = ort.SessionOptions()
    options.intra_op_num_threads = max(1, min(3, (os.cpu_count() or 4) - 1))
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])
    inputs = {item.name: encoded[item.name] for item in session.get_inputs()}
    output = session.run(None, inputs)[0]
    return normalize(output[:, 0, :])


def cosine_rows(left: np.ndarray, right: np.ndarray) -> list[float]:
    return np.sum(left * right, axis=1).astype(float).tolist()


def benchmark(tokenizer_dir: Path, model_path: Path, output: Path, reference_report: Path | None) -> None:
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_dir, local_files_only=True)
    encoded = tokenizer(SENTENCES, padding=True, truncation=True, max_length=512, return_tensors="np")
    process = psutil.Process()
    before = process.memory_info().rss
    started = time.perf_counter()
    candidate = ort_embeddings(model_path, encoded)
    duration_ms = (time.perf_counter() - started) * 1000
    after = process.memory_info().rss
    reference = candidate if reference_report is None else np.asarray(
        json.loads(reference_report.read_text("utf-8"))["embeddings"], dtype=np.float32
    )
    report = {
        "modelPath": str(model_path),
        "dimension": int(candidate.shape[1]),
        "rowNorms": np.linalg.norm(candidate, axis=1).astype(float).tolist(),
        "referenceCosines": cosine_rows(reference, candidate),
        "embeddings": candidate.astype(float).tolist(),
        "durationMs": duration_ms,
        "rssBeforeBytes": before,
        "rssAfterBytes": after,
        "rssDeltaBytes": max(0, after - before),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), "utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tokenizer-dir", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--reference-report", type=Path)
    args = parser.parse_args()
    benchmark(args.tokenizer_dir, args.model, args.output, args.reference_report)
