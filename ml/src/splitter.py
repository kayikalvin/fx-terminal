"""Time-series splitter for cross-validation and train/test splits."""

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from src.preprocess import ProcessedData
from typing import Generator, Tuple

class TimeSeriesSplitter:
    def __init__(self, n_splits: int = 5) -> None:
        self.tscv = TimeSeriesSplit(n_splits=n_splits)

    def split(self, data: ProcessedData) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
        """Yield (train_idx, val_idx) for each fold."""
        for train_idx, val_idx in self.tscv.split(data.X):
            yield train_idx, val_idx

    def train_test_split(self, data: ProcessedData, test_size: float = 0.2):
        """Simple chronological split, keeping the last `test_size` fraction for final evaluation."""
        n = len(data.X)
        split_point = int(n * (1 - test_size))
        train_X, test_X = data.X[:split_point], data.X[split_point:]
        train_y, test_y = data.y[:split_point], data.y[split_point:]
        return train_X, test_X, train_y, test_y