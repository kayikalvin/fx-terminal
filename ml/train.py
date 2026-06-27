"""Main training pipeline – train multiple models, export logistic regression."""

import logging
from pathlib import Path
import pandas as pd
from src.config import Config
from src.dataset_builder import DatasetBuilder
from src.preprocess import Preprocessor
from src.splitter import TimeSeriesSplitter
from src.ml_models.logistic import LogisticModel
from src.ml_models.random_forest import RandomForestModel
from src.ml_models.gradient_boosting import GradientBoostingModel
from src.evaluation import evaluate_model
from src.exporter import export_model_json

logging.basicConfig(level=logging.INFO)

def main():
    config = Config()

    # 1. Build dataset
    builder = DatasetBuilder(config)
    if not (config.data_processed / "training_dataset.csv").exists():
        master = builder.build()
    else:
        master = pd.read_csv(config.data_processed / "training_dataset.csv")

    # 2. Preprocess
    preprocessor = Preprocessor(feature_names=list(config.feature_names))
    data = preprocessor.fit_transform(master)
    preprocessor.save_scaler(config.models_dir / "scaler.pkl")

    # 3. Split
    splitter = TimeSeriesSplitter()
    folds = list(splitter.split(data))
    train_idx, test_idx = folds[-1]
    X_train, X_test = data.X[train_idx], data.X[test_idx]
    y_train, y_test = data.y[train_idx], data.y[test_idx]

    # 4. Train all models
    models = {
        "logistic": LogisticModel(**config.logistic_params),
        "random_forest": RandomForestModel(**config.rf_params),
        "gradient_boosting": GradientBoostingModel(**config.gb_params),
    }

    results = {}
    best_model = None
    best_score = -1
    best_name = ""

    for name, model in models.items():
        print(f"\n--- Training {name} ---")
        model.train(X_train, y_train)
        metrics = evaluate_model(model, X_test, y_test)
        results[name] = metrics
        if metrics["roc_auc"] > best_score:
            best_score = metrics["roc_auc"]
            best_model = model
            best_name = name

    print("\n=== Model Comparison ===")
    for name, m in results.items():
        print(f"{name}: ROC AUC = {m['roc_auc']:.4f}, Accuracy = {m['accuracy']:.4f}")
    print(f"\nBest model: {best_name} (ROC AUC = {best_score:.4f})")

    # 5. Save all models
    for name, model in models.items():
        model.save(config.models_dir / f"{name}.pkl")

    # 6. Export the LOGISTIC model for browser inference
    logistic_model = models["logistic"]
    logistic_metrics = results["logistic"]

    if best_name != "logistic":
        print(f"\nNote: {best_name} performed best, but browser inference only supports logistic regression.")
        print(f"Exporting logistic regression (ROC AUC = {logistic_metrics['roc_auc']:.4f}) instead.")

    export_model_json(
        model=logistic_model.model,        # the underlying sklearn LogisticRegression
        scaler=preprocessor.scaler,
        feature_names=list(config.feature_names),
        metrics=logistic_metrics,
        output_path=config.exports_dir / "model.json"
    )

    print("\nTraining complete. You can now import model.json into the terminal.")

if __name__ == "__main__":
    main()





















# """Main training pipeline – train multiple models and export the best."""

# import logging
# from pathlib import Path
# import pandas as pd
# from src.config import Config
# from src.dataset_builder import DatasetBuilder
# from src.preprocess import Preprocessor
# from src.splitter import TimeSeriesSplitter
# from src.ml_models.logistic import LogisticModel
# from src.ml_models.random_forest import RandomForestModel
# from src.ml_models.gradient_boosting import GradientBoostingModel
# from src.evaluation import evaluate_model
# from src.exporter import export_model_json

# logging.basicConfig(level=logging.INFO)

# def main():
#     config = Config()

#     # 1. Build dataset
#     builder = DatasetBuilder(config)
#     if not (config.data_processed / "training_dataset.csv").exists():
#         master = builder.build()
#     else:
#         master = pd.read_csv(config.data_processed / "training_dataset.csv")

#     # 2. Preprocess
#     preprocessor = Preprocessor(feature_names=list(config.feature_names))
#     data = preprocessor.fit_transform(master)
#     preprocessor.save_scaler(config.models_dir / "scaler.pkl")

#     # 3. Split (time-series)
#     splitter = TimeSeriesSplitter()
#     folds = list(splitter.split(data))
#     train_idx, test_idx = folds[-1]   # use last fold for final evaluation
#     X_train, X_test = data.X[train_idx], data.X[test_idx]
#     y_train, y_test = data.y[train_idx], data.y[test_idx]

#     # 4. Train multiple models
#     models = {
#         "logistic": LogisticModel(**config.logistic_params),
#         "random_forest": RandomForestModel(**config.rf_params),
#         "gradient_boosting": GradientBoostingModel(**config.gb_params),
#     }

#     best_model = None
#     best_score = -1
#     best_name = ""
#     results = {}

#     for name, model in models.items():
#         print(f"\n--- Training {name} ---")
#         model.train(X_train, y_train)
#         metrics = evaluate_model(model, X_test, y_test)
#         results[name] = metrics
#         if metrics["roc_auc"] > best_score:
#             best_score = metrics["roc_auc"]
#             best_model = model
#             best_name = name

#     print("\n=== Model Comparison ===")
#     for name, m in results.items():
#         print(f"{name}: ROC AUC = {m['roc_auc']:.4f}, Accuracy = {m['accuracy']:.4f}")
#     print(f"\nBest model: {best_name} (ROC AUC = {best_score:.4f})")

#     # 5. Save the best model
#     best_model.save(config.models_dir / "best_model.pkl")

#     # 6. Export for browser
#     export_model_json(
#         model=best_model.model,   # the underlying sklearn model
#         scaler=preprocessor.scaler,
#         feature_names=list(config.feature_names),
#         metrics=results[best_name],
#         output_path=config.exports_dir / "model.json"
#     )

#     print(f"\nExported {best_name} to model.json. You can now import it into the terminal.")

# if __name__ == "__main__":
#     main()