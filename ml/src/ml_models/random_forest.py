"""Random Forest wrapper."""

from pathlib import Path
from typing import Any, Dict
import joblib
from sklearn.ensemble import RandomForestClassifier
from src.ml_models.base import BaseModel

class RandomForestModel(BaseModel):
    def __init__(self, **params) -> None:
        self.model = RandomForestClassifier(**params)

    def train(self, X, y) -> None:
        self.model.fit(X, y)

    def predict(self, X):
        return self.model.predict(X)

    def predict_proba(self, X):
        return self.model.predict_proba(X)[:, 1]

    def save(self, path: Path) -> None:
        joblib.dump(self.model, path)

    @classmethod
    def load(cls, path: Path) -> "RandomForestModel":
        model = joblib.load(path)
        obj = cls()
        obj.model = model
        return obj

    def get_params(self) -> Dict[str, Any]:
        return self.model.get_params()