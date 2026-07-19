import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"))
from benchmark_model import normalize


def test_normalize_returns_unit_rows() -> None:
    result = normalize(np.array([[3.0, 4.0]], dtype=np.float32))
    assert np.allclose(result, [[0.6, 0.8]])


def test_normalize_rejects_zero_rows() -> None:
    with pytest.raises(ValueError, match="invalid embedding norm"):
        normalize(np.zeros((1, 2), dtype=np.float32))
