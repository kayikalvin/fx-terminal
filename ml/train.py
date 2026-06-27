"""Main training pipeline."""

import logging
from pathlib import Path
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
        import pandas as pd
        master = pd.read_csv(config.data_processed / "training_dataset.csv")

    # 2. Preprocess
    preprocessor = Preprocessor(feature_names=list(config.feature_names))
    data = preprocessor.fit_transform(master)
    # Save scaler
    preprocessor.save_scaler(config.models_dir / "scaler.pkl")

    # 3. Split (time-series train/test)
    splitter = TimeSeriesSplitter()
    # Use the last fold's test set as final evaluation
    folds = list(splitter.split(data))
    # For a quick demo, use the last fold
    train_idx, test_idx = folds[-1]

    X_train, X_test = data.X[train_idx], data.X[test_idx]
    y_train, y_test = data.y[train_idx], data.y[test_idx]

    # 4. Train models
    model = LogisticModel(**config.logistic_params)
    model.train(X_train, y_train)
    model.save(config.models_dir / "logistic.pkl")

    # 5. Evaluate
    metrics = evaluate_model(model, X_test, y_test, config.feature_names)

    # 6. Export for browser
    export_model_json(
        model=model.model,   # the underlying sklearn model
        scaler=preprocessor.scaler,
        feature_names=list(config.feature_names),
        metrics=metrics,
        output_path=config.exports_dir / "model.json"
    )

    print("Training complete. You can now import model.json into the terminal.")

if __name__ == "__main__":
    main()