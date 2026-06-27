"""Logistic Regression wrapper."""

from pathlib import Path
from typing import Any, Dict
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from src.ml_models.base import BaseModel

class LogisticModel(BaseModel):
    def __init__(self, **params) -> None:
        self.model = LogisticRegression(**params)

    def train(self, X, y) -> None:
        self.model.fit(X, y)

    def predict(self, X):
        return self.model.predict(X)

    def predict_proba(self, X):
        return self.model.predict_proba(X)[:, 1]   # probability of class 1

    def save(self, path: Path) -> None:
        joblib.dump(self.model, path)

    @classmethod
    def load(cls, path: Path) -> "LogisticModel":
        model = joblib.load(path)
        obj = cls()
        obj.model = model
        return obj

    def get_params(self) -> Dict[str, Any]:
        return self.model.get_params()