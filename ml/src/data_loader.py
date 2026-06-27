"""Load and validate raw OHLC data."""

import pandas as pd
from pathlib import Path
from typing import Dict, Any

class DataLoader:
    REQUIRED_COLUMNS = ["Date", "Open", "High", "Low", "Close"]

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.df: pd.DataFrame = None

    def load(self) -> pd.DataFrame:
        """Load CSV, parse dates, clean numeric columns, and validate."""
        df = pd.read_csv(self.file_path)
        self._validate_columns(df)

        # Convert OHLC columns to numeric, coercing errors to NaN
        for col in ["Open", "High", "Low", "Close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # Drop rows with NaN in OHLC (either originally missing or failed conversion)
        df = df.dropna(subset=self.REQUIRED_COLUMNS)

        # Now perform range checks (only if data remains)
        if df.empty:
            raise ValueError(f"No valid OHLC data after cleaning in {self.file_path}")
        for col in ["Open", "High", "Low", "Close"]:
            if (df[col] <= 0).any():
                raise ValueError(f"Non‑positive values found in column '{col}' in {self.file_path}")

        # Parse dates
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        df = df.dropna(subset=["Date"])
        df = df.sort_values("Date").reset_index(drop=True)
        df = df.drop_duplicates(subset=["Date"])

        self.df = df
        return df

    def _validate_columns(self, df: pd.DataFrame) -> None:
        missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns {missing} in {self.file_path}")

    def summary(self) -> Dict[str, Any]:
        return {
            "file": str(self.file_path),
            "rows": len(self.df),
            "start_date": self.df["Date"].min(),
            "end_date": self.df["Date"].max(),
            "columns": list(self.df.columns)
        }