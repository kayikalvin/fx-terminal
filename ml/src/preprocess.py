"""Feature scaling and data preparation."""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from dataclasses import dataclass
from typing import List
import joblib
from pathlib import Path

@dataclass
class ProcessedData:
    X: np.ndarray
    y: np.ndarray
    dates: pd.Series
    pairs: pd.Series
    feature_names: List[str]

class Preprocessor:
    def __init__(self, feature_names: List[str]) -> None:
        self.feature_names = feature_names
        self.scaler = StandardScaler()

    def fit_transform(self, df: pd.DataFrame) -> ProcessedData:
        X = df[self.feature_names].values
        self.scaler.fit(X)
        X_scaled = self.scaler.transform(X)
        return ProcessedData(
            X=X_scaled,
            y=df["target"].values,
            dates=df["Date"],
            pairs=df["pair"],
            feature_names=self.feature_names
        )

    def save_scaler(self, path: Path) -> None:
        joblib.dump(self.scaler, path)

    def load_scaler(self, path: Path) -> None:
        self.scaler = joblib.load(path)