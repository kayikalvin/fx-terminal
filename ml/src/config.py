"""Centralised configuration for the ML pipeline."""

from dataclasses import dataclass, field
from pathlib import Path

@dataclass(frozen=True)
class Config:
    # Paths
    data_raw: Path = Path("data/raw")
    data_processed: Path = Path("data/processed")
    models_dir: Path = Path("models")
    reports_dir: Path = Path("reports")
    exports_dir: Path = Path("exports")

    # Dataset
    feature_names: tuple = (
        "rsi_14", "sma_20", "sma_50", "ema_20",
        "atr_14", "sma20_dist", "sma50_dist", "ema20_dist",
        "daily_return", "weekly_return", "monthly_return",
        "momentum", "rolling_volatility", "atr_pct",
        "trend", "volatility_percentile", "price_position",
        "rolling_high", "rolling_low"
    )
    target_column: str = "target"

    # Processing
    random_seed: int = 42
    test_size: int = 0.2                # fraction for final evaluation (not used in time series)
    max_train_window: int = 500         # max rows for training (optional)

    # Model hyperparameters
    logistic_params: dict = field(default_factory=lambda: {
        "class_weight": "balanced",
        "max_iter": 1000,
        "random_state": 42
    })
    rf_params: dict = field(default_factory=lambda: {
        "n_estimators": 100,
        "max_depth": 5,
        "min_samples_leaf": 50,
        "random_state": 42
    })
    gb_params: dict = field(default_factory=lambda: {
        "n_estimators": 100,
        "max_depth": 3,
        "learning_rate": 0.1,
        "random_state": 42
    })

    # Cross-validation
    cv_splits: int = 5

    # Logging
    log_level: str = "INFO"