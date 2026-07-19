from __future__ import annotations

import argparse
import json
import os
import threading
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
    if left.shape != right.shape:
        raise ValueError(f"reference/candidate shape mismatch: {left.shape} vs {right.shape}")
    values = np.sum(left * right, axis=1).astype(float)
    if not np.all(np.isfinite(values)):
        raise ValueError("non-finite cosine similarity detected")
    return values.tolist()


class RssSampler:
    """Background thread that polls current-process RSS and tracks the peak."""

    def __init__(self, interval: float = 0.005) -> None:
        self._interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._process = psutil.Process()
        self._peak: int = 0
        self._baseline: int = 0
        self._running = False

    def start(self) -> None:
        self._baseline = self._process.memory_info().rss
        self._peak = self._baseline
        self._stop.clear()
        self._running = True
        self._thread = threading.Thread(target=self._sample, daemon=True)
        self._thread.start()

    def _sample(self) -> None:
        while not self._stop.wait(self._interval):
            rss = self._process.memory_info().rss
            if rss > self._peak:
                self._peak = rss
        # Final sample after stop signal
        rss = self._process.memory_info().rss
        if rss > self._peak:
            self._peak = rss

    def stop(self) -> None:
        if not self._running:
            return
        self._stop.set()
        if self._thread is not None and self._thread is not threading.current_thread():
            self._thread.join()
        rss = self._process.memory_info().rss
        if rss > self._peak:
            self._peak = rss
        self._running = False

    @property
    def peak_rss_bytes(self) -> int:
        return self._peak

    @property
    def baseline_rss_bytes(self) -> int:
        return self._baseline

    def __enter__(self) -> RssSampler:
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.stop()


def _run_with_sampler(fn, interval: float = 0.005):
    """Run *fn* while sampling RSS; return (result, peak_rss_bytes, baseline_rss_bytes)."""
    sampler = RssSampler(interval=interval)
    try:
        sampler.start()
        result = fn()
    except BaseException:
        sampler.stop()
        raise
    sampler.stop()
    return result, sampler.peak_rss_bytes, sampler.baseline_rss_bytes


def benchmark(tokenizer_dir: Path, model_path: Path, output: Path, reference_report: Path | None) -> None:
    def _run():
        nonlocal duration_ms
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_dir, local_files_only=True)
        encoded = tokenizer(SENTENCES, padding=True, truncation=True, max_length=512, return_tensors="np")
        started = time.perf_counter()
        result = ort_embeddings(model_path, encoded)
        duration_ms = (time.perf_counter() - started) * 1000
        return result

    duration_ms = 0.0
    candidate, peak_rss, baseline_rss = _run_with_sampler(_run)
    final_rss = psutil.Process().memory_info().rss
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
        "rssBeforeBytes": baseline_rss,
        "rssAfterBytes": final_rss,
        "rssDeltaBytes": max(0, final_rss - baseline_rss),
        "peakRssBytes": peak_rss,
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
