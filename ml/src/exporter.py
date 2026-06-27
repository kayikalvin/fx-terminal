"""Export trained model and scaler to JSON for browser inference."""

import json
import numpy as np
from pathlib import Path
from typing import List

def export_model_json(
    model,
    scaler,
    feature_names: List[str],
    metrics: dict,
    output_path: Path
) -> None:
    """
    Exports a model.json containing:
    - model type, coefficients, intercept
    - scaler mean, std
    - feature names
    - evaluation metrics
    """
    coeffs = model.coef_.flatten().tolist()
    intercept = model.intercept_.flatten()[0]
    scaler_mean = scaler.mean_.tolist()
    scaler_std = scaler.scale_.tolist()

    export_data = {
        "model_type": "logistic",
        "features": feature_names,
        "weights": coeffs,
        "intercept": intercept,
        "scaler": {
            "mean": scaler_mean,
            "std": scaler_std
        },
        "metrics": metrics
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(export_data, f, indent=2)
    print(f"Model exported to {output_path}")