"""Load and validate raw OHLC data."""

import pandas as pd
from pathlib import Path
from typing import Dict, Any

class DataLoader:
    """Loads a CSV file and validates required columns."""

    REQUIRED_COLUMNS = ["Date", "Open", "High", "Low", "Close"]

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.df: pd.DataFrame = None

    def load(self) -> pd.DataFrame:
        """Load CSV, parse dates, sort, remove duplicates and missing values."""
        df = pd.read_csv(self.file_path)
        self._validate_columns(df)
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").reset_index(drop=True)
        df = df.drop_duplicates(subset=["Date"])
        df = df.dropna(subset=self.REQUIRED_COLUMNS)
        # Basic range checks
        for col in ["Open", "High", "Low", "Close"]:
            if (df[col] <= 0).any():
                raise ValueError(f"Non-positive values found in column '{col}' in {self.file_path}")
        self.df = df
        return df

    def _validate_columns(self, df: pd.DataFrame) -> None:
        missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns {missing} in {self.file_path}")

    def summary(self) -> Dict[str, Any]:
        """Return a summary of the loaded data."""
        return {
            "file": str(self.file_path),
            "rows": len(self.df),
            "start_date": self.df["Date"].min(),
            "end_date": self.df["Date"].max(),
            "columns": list(self.df.columns)
        }