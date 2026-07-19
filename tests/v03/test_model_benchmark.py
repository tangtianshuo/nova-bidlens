import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"))
from benchmark_model import RssSampler, _run_with_sampler, cosine_rows, normalize


# --- normalize / cosine_rows (existing) ---


def test_normalize_returns_unit_rows() -> None:
    result = normalize(np.array([[3.0, 4.0]], dtype=np.float32))
    assert np.allclose(result, [[0.6, 0.8]])


def test_normalize_rejects_zero_rows() -> None:
    with pytest.raises(ValueError, match="invalid embedding norm"):
        normalize(np.zeros((1, 2), dtype=np.float32))


def test_cosine_rows_returns_correct_values() -> None:
    left = np.array([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)
    right = np.array([[1.0, 0.0], [1.0, 0.0]], dtype=np.float32)
    result = cosine_rows(left, right)
    assert np.allclose(result, [1.0, 0.0])


def test_cosine_rows_rejects_shape_mismatch() -> None:
    left = np.array([[1.0, 0.0]], dtype=np.float32)
    right = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)
    with pytest.raises(ValueError, match="shape mismatch"):
        cosine_rows(left, right)


def test_cosine_rows_rejects_non_finite_values() -> None:
    left = np.array([[np.inf, 0.0]], dtype=np.float32)
    right = np.array([[1.0, 0.0]], dtype=np.float32)
    with pytest.raises(ValueError, match="non-finite"):
        cosine_rows(left, right)


# --- RssSampler ---


def test_sampler_peak_rss_positive() -> None:
    sampler = RssSampler(interval=0.01)
    sampler.start()
    # Allocate some memory to ensure peak > 0
    _ = bytearray(1024 * 1024)
    sampler.stop()
    assert sampler.peak_rss_bytes > 0


def test_sampler_peak_ge_baseline() -> None:
    sampler = RssSampler(interval=0.01)
    sampler.start()
    baseline = sampler.baseline_rss_bytes
    _ = bytearray(4 * 1024 * 1024)
    sampler.stop()
    assert sampler.peak_rss_bytes >= baseline


def test_sampler_stop_is_idempotent() -> None:
    sampler = RssSampler(interval=0.01)
    sampler.start()
    sampler.stop()
    first_peak = sampler.peak_rss_bytes
    sampler.stop()
    assert sampler.peak_rss_bytes == first_peak


def test_sampler_stop_on_exception() -> None:
    sampler = RssSampler(interval=0.01)
    sampler.start()
    try:
        raise RuntimeError("simulated failure")
    except RuntimeError:
        sampler.stop()
    assert sampler.peak_rss_bytes > 0


def test_sampler_context_manager() -> None:
    with RssSampler(interval=0.01) as s:
        _ = bytearray(1024 * 1024)
        peak_inside = s.peak_rss_bytes
    assert peak_inside > 0
    assert s.peak_rss_bytes >= peak_inside


def test_sampler_context_manager_stops_on_exception() -> None:
    with pytest.raises(RuntimeError):
        with RssSampler(interval=0.01) as s:
            raise RuntimeError("boom")
    assert s.peak_rss_bytes > 0


# --- _run_with_sampler / report peakRssBytes ---


def test_run_with_sampler_returns_peak_and_baseline() -> None:
    def fake_run():
        _ = bytearray(2 * 1024 * 1024)
        return 42

    result, peak, baseline = _run_with_sampler(fake_run)
    assert result == 42
    assert peak > 0
    assert baseline > 0
    assert peak >= baseline


def test_run_with_sampler_propagates_exception() -> None:
    def bad_run():
        raise ValueError("test error")

    with pytest.raises(ValueError, match="test error"):
        _run_with_sampler(bad_run)


def test_report_includes_rss_fields(tmp_path: Path) -> None:
    """Benchmark report JSON contains all four RSS fields with correct types."""
    from unittest.mock import MagicMock, patch

    fake_embeddings = np.eye(2, dtype=np.float32)
    fake_tokenizer = MagicMock()
    fake_tokenizer.return_value = {"input_ids": np.zeros((2, 2), dtype=np.int64)}

    with patch("benchmark_model.AutoTokenizer.from_pretrained", return_value=fake_tokenizer):
        with patch("benchmark_model.ort_embeddings", return_value=fake_embeddings):
            from benchmark_model import benchmark

            out = tmp_path / "report.json"
            benchmark(Path("/fake/tokenizer"), Path("/fake/model.onnx"), out, None)
            report = json.loads(out.read_text("utf-8"))

            for field in ("rssBeforeBytes", "rssAfterBytes", "rssDeltaBytes", "peakRssBytes"):
                assert field in report, f"missing field: {field}"
                assert isinstance(report[field], int), f"{field} must be int"

            assert report["rssBeforeBytes"] > 0
            assert report["rssAfterBytes"] > 0
            assert report["peakRssBytes"] > 0
            assert report["peakRssBytes"] >= report["rssBeforeBytes"]
            assert report["rssDeltaBytes"] == max(0, report["rssAfterBytes"] - report["rssBeforeBytes"])
            assert report["rssDeltaBytes"] >= 0


def test_report_rss_delta_nonnegative_when_rss_decreases(tmp_path: Path) -> None:
    """rssDeltaBytes is nonnegative even when final RSS < baseline RSS."""
    from unittest.mock import MagicMock, patch

    fake_embeddings = np.eye(2, dtype=np.float32)
    fake_tokenizer = MagicMock()
    fake_tokenizer.return_value = {"input_ids": np.zeros((2, 2), dtype=np.int64)}

    fake_baseline = 200 * 1024 * 1024
    fake_final = 100 * 1024 * 1024  # less than baseline

    with patch("benchmark_model.AutoTokenizer.from_pretrained", return_value=fake_tokenizer):
        with patch("benchmark_model.ort_embeddings", return_value=fake_embeddings):
            with patch("benchmark_model._run_with_sampler", return_value=(fake_embeddings, fake_baseline, fake_baseline)):
                with patch("benchmark_model.psutil") as mock_psutil:
                    mock_proc = MagicMock()
                    mock_proc.memory_info.return_value.rss = fake_final
                    mock_psutil.Process.return_value = mock_proc

                    from benchmark_model import benchmark

                    out = tmp_path / "report.json"
                    benchmark(Path("/fake/tokenizer"), Path("/fake/model.onnx"), out, None)
                    report = json.loads(out.read_text("utf-8"))

                    assert report["rssDeltaBytes"] == 0
                    assert report["rssAfterBytes"] < report["rssBeforeBytes"]


def test_duration_ms_times_only_ort_embeddings(tmp_path: Path) -> None:
    """durationMs excludes tokenizer construction and encoding."""
    import time as time_mod
    from unittest.mock import MagicMock, patch

    fake_embeddings = np.eye(2, dtype=np.float32)
    fake_tokenizer = MagicMock()
    fake_tokenizer.return_value = {"input_ids": np.zeros((2, 2), dtype=np.int64)}

    tokenizer_delay = 0.3
    ort_delay = 0.01

    def slow_tokenizer(*args, **kwargs):
        time_mod.sleep(tokenizer_delay)
        return fake_tokenizer

    def slow_ort(*args, **kwargs):
        time_mod.sleep(ort_delay)
        return fake_embeddings

    with patch("benchmark_model.AutoTokenizer.from_pretrained", side_effect=slow_tokenizer):
        with patch("benchmark_model.ort_embeddings", side_effect=slow_ort):
            from benchmark_model import benchmark

            out = tmp_path / "report.json"
            benchmark(Path("/fake/tokenizer"), Path("/fake/model.onnx"), out, None)
            report = json.loads(out.read_text("utf-8"))

            duration_s = report["durationMs"] / 1000
            assert duration_s < tokenizer_delay, (
                f"durationMs includes tokenizer time: {duration_s:.3f}s >= {tokenizer_delay}s"
            )
            assert duration_s >= ort_delay * 0.5
