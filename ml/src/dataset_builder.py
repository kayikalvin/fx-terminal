"""Build the master training dataset from all raw CSV files."""

import pandas as pd
from pathlib import Path
from typing import List
from src.data_loader import DataLoader
from src.feature_engineering import FeatureEngineer
from src.config import Config

class DatasetBuilder:
    def __init__(self, config: Config) -> None:
        self.config = config

    def build(self) -> pd.DataFrame:
        """Load raw CSVs, apply feature engineering, merge, save."""
        raw_files = list(self.config.data_raw.glob("*.csv"))
        if not raw_files:
            raise FileNotFoundError(f"No CSV files found in {self.config.data_raw}")

        all_dfs = []
        for file_path in raw_files:
            print(f"Processing {file_path.name}...")
            loader = DataLoader(file_path)
            df = loader.load()
            # Add pair column based on filename (e.g., EURUSD.csv → EURUSD)
            pair = file_path.stem
            df["pair"] = pair
            engineer = FeatureEngineer(df)
            featured = engineer.generate_features()
            all_dfs.append(featured)

        master = pd.concat(all_dfs, ignore_index=True)
        # Save processed dataset
        master.to_csv(self.config.data_processed / "training_dataset.csv", index=False)
        print(f"Master dataset saved with {len(master)} rows.")
        return master