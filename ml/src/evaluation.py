"""Model evaluation and reporting."""

import json
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix
)
from pathlib import Path
from typing import Dict, Any
import matplotlib.pyplot as plt

def evaluate_model(model, X_test, y_test, feature_names=None) -> Dict[str, Any]:
    """Compute standard classification metrics."""
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_test, y_proba)
    }
    print("Evaluation Metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    cm = confusion_matrix(y_test, y_pred)
    print("Confusion Matrix:")
    print(cm)
    return metrics

def plot_roc_curve(model, X_test, y_test, save_path: Path = None) -> None:
    from sklearn.metrics import RocCurveDisplay
    RocCurveDisplay.from_estimator(model, X_test, y_test)
    plt.title("ROC Curve")
    if save_path:
        plt.savefig(save_path / "roc_curve.png")
    plt.show()

def plot_confusion_matrix(model, X_test, y_test, save_path: Path = None) -> None:
    from sklearn.metrics import ConfusionMatrixDisplay
    ConfusionMatrixDisplay.from_estimator(model, X_test, y_test)
    plt.title("Confusion Matrix")
    if save_path:
        plt.savefig(save_path / "confusion_matrix.png")
    plt.show()