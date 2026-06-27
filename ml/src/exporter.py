"""Export trained model and scaler to JSON for browser inference."""

import json
import numpy as np
from pathlib import Path
from typing import Any, Dict

def export_model_json(
    model,                 # sklearn model (must have predict_proba)
    scaler,                # StandardScaler instance
    feature_names,         # list of str
    metrics: Dict[str, Any],
    output_path: Path
) -> None:
    """
    Exports a model.json that the React terminal can load.
    Works with LogisticRegression, RandomForestClassifier, GradientBoostingClassifier.
    """
    export_data = {
        "features": feature_names,
        "metrics": metrics,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "std": scaler.scale_.tolist()
        }
    }

    # Check model type
    model_type = type(model).__name__
    if hasattr(model, 'coef_') and hasattr(model, 'intercept_'):
        # Linear model (LogisticRegression, LinearSVC, etc.)
        export_data["model_type"] = "logistic"
        export_data["weights"] = model.coef_.flatten().tolist()
        export_data["intercept"] = model.intercept_.flatten()[0]
    elif hasattr(model, 'feature_importances_'):
        # Tree-based model (RandomForest, GradientBoosting, etc.)
        export_data["model_type"] = model_type
        export_data["feature_importances"] = model.feature_importances_.tolist()
        # We cannot provide weights/intercept, so the browser cannot use this directly.
        # The UI will show a message that this model type requires a different predictor.
    else:
        raise TypeError(f"Unsupported model type: {model_type}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(export_data, f, indent=2)
    print(f"Model exported to {output_path} (type: {export_data.get('model_type')})")






















# """Export trained model and scaler to JSON for browser inference."""

# import json
# import numpy as np
# from pathlib import Path
# from typing import List

# def export_model_json(
#     model,
#     scaler,
#     feature_names: List[str],
#     metrics: dict,
#     output_path: Path
# ) -> None:
#     """
#     Exports a model.json containing:
#     - model type, coefficients, intercept
#     - scaler mean, std
#     - feature names
#     - evaluation metrics
#     """
#     coeffs = model.coef_.flatten().tolist()
#     intercept = model.intercept_.flatten()[0]
#     scaler_mean = scaler.mean_.tolist()
#     scaler_std = scaler.scale_.tolist()

#     export_data = {
#         "model_type": "logistic",
#         "features": feature_names,
#         "weights": coeffs,
#         "intercept": intercept,
#         "scaler": {
#             "mean": scaler_mean,
#             "std": scaler_std
#         },
#         "metrics": metrics
#     }

#     output_path.parent.mkdir(parents=True, exist_ok=True)
#     with open(output_path, "w") as f:
#         json.dump(export_data, f, indent=2)
#     print(f"Model exported to {output_path}")