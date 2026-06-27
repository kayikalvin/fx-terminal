from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"

RAW_DATA_DIR = DATA_DIR / "raw"

PROCESSED_DATA_DIR = DATA_DIR / "processed"

EXPORT_DIR = DATA_DIR / "exports"

MODELS_DIR = BASE_DIR / "models"

REPORTS_DIR = BASE_DIR / "reports"

FIGURES_DIR = REPORTS_DIR / "figures"

METRICS_DIR = REPORTS_DIR / "metrics"


FEATURE_COLUMNS = [
    "rsi",
    "sma20_distance",
    "sma50_distance",
    "atr_pct",
    "momentum",
    "daily_return",
    "weekly_return",
    "trend",
    "volatility_rank"
]

TARGET_COLUMN = "target"

RANDOM_STATE = 42