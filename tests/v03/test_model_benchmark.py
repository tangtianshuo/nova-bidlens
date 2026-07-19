import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"))
from benchmark_model import cosine_rows, normalize


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
