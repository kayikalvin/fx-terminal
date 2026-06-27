"""Abstract base class for all ML models."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict
import joblib

class BaseModel(ABC):
    @abstractmethod
    def train(self, X, y) -> None:
        pass

    @abstractmethod
    def predict(self, X):
        pass

    @abstractmethod
    def predict_proba(self, X):
        pass

    @abstractmethod
    def save(self, path: Path) -> None:
        pass

    @classmethod
    @abstractmethod
    def load(cls, path: Path) -> "BaseModel":
        pass

    @abstractmethod
    def get_params(self) -> Dict[str, Any]:
        pass