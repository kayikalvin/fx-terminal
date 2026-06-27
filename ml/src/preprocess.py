from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler

from .config import FEATURE_COLUMNS, TARGET_COLUMN


@dataclass
class ProcessedData:
    X: np.ndarray
    y: np.ndarray


class Preprocessor:
    """
    Handles feature preprocessing for the ML pipeline.
    """

    def __init__(self):
        self.scaler = StandardScaler()

    def fit_transform(self, df):
        """
        Fit the scaler and transform the training data.
        """

        X = df[FEATURE_COLUMNS].copy()
        y = df[TARGET_COLUMN].astype(int).values

        X_scaled = self.scaler.fit_transform(X)

        return ProcessedData(
            X=X_scaled,
            y=y
        )

    def transform(self, df):
        """
        Transform new data using an already-fitted scaler.
        """

        X = df[FEATURE_COLUMNS].copy()
        y = df[TARGET_COLUMN].astype(int).values

        X_scaled = self.scaler.transform(X)

        return ProcessedData(
            X=X_scaled,
            y=y
        )

    def save_scaler(self, path):
        """
        Save the fitted scaler to disk.
        """

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        joblib.dump(self.scaler, path)

    def load_scaler(self, path):
        """
        Load a previously saved scaler.
        """

        self.scaler = joblib.load(path)

    def summary(self, processed):
        """
        Display preprocessing statistics.
        """

        print("\n")
        print("=" * 60)
        print("PREPROCESSING SUMMARY")
        print("=" * 60)

        print(f"Samples : {processed.X.shape[0]}")
        print(f"Features: {processed.X.shape[1]}")

        print()

        print("Means")
        print(self.scaler.mean_)

        print()

        print("Standard Deviations")
        print(self.scaler.scale_)

        print("=" * 60)