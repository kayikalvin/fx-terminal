from pathlib import Path
import pandas as pd

from .config import FEATURE_COLUMNS, TARGET_COLUMN


class DataLoader:
    """
    Loads and validates FX Research Terminal datasets.
    """

    REQUIRED_COLUMNS = (
        ["date", "pair"] +
        FEATURE_COLUMNS +
        [TARGET_COLUMN]
    )

    def __init__(self, filepath):
        self.filepath = Path(filepath)

    # -------------------------------------------------------
    # Public Methods
    # -------------------------------------------------------

    def load(self):
        """
        Load and clean the dataset.
        """

        if not self.filepath.exists():
            raise FileNotFoundError(
                f"Dataset not found:\n{self.filepath}"
            )

        print(f"\nLoading dataset: {self.filepath.name}")

        df = pd.read_csv(self.filepath)

        self._validate_columns(df)

        # Parse dates
        df["date"] = pd.to_datetime(df["date"])

        # Sort chronologically
        df = df.sort_values("date")

        # Remove duplicates
        duplicates = df.duplicated().sum()

        if duplicates > 0:
            print(f"Removed {duplicates} duplicate rows.")

        df = df.drop_duplicates()

        # Remove missing values
        missing = df.isnull().sum().sum()

        if missing > 0:
            print(f"Removed rows containing {missing} missing values.")

        df = df.dropna()

        df.reset_index(drop=True, inplace=True)

        # Validate feature ranges
        self.validate_ranges(df)

        return df

    def summary(self, df):
        """
        Print dataset information.
        """

        print("\n" + "=" * 60)
        print("DATASET SUMMARY")
        print("=" * 60)

        print(f"Dataset:          {self.filepath.name}")
        print(f"Rows:             {len(df)}")
        print(f"Columns:          {len(df.columns)}")

        print(
            f"Date Range:       "
            f"{df['date'].min().date()}  →  {df['date'].max().date()}"
        )

        print(
            f"Currency Pairs:   "
            f"{', '.join(sorted(df['pair'].unique()))}"
        )

        print(f"Missing Values:   {df.isnull().sum().sum()}")

        print()

        print("Feature Statistics")

        print("-" * 60)

        print(df[FEATURE_COLUMNS].describe().round(4))

        print()

        print("Target Distribution")

        print("-" * 60)

        print(df[TARGET_COLUMN].value_counts().sort_index())

        print("=" * 60)

    # -------------------------------------------------------
    # Validation
    # -------------------------------------------------------

    def validate_ranges(self, df):
        """
        Validate that feature values are within expected ranges.
        """

        if ((df["rsi"] < 0) | (df["rsi"] > 100)).any():
            raise ValueError(
                "RSI values must be between 0 and 100."
            )

        if (~df["trend"].isin([0, 1])).any():
            raise ValueError(
                "Trend values must be either 0 or 1."
            )

        if (~df[TARGET_COLUMN].isin([0, 1])).any():
            raise ValueError(
                "Target values must be either 0 or 1."
            )

        if (
            (df["volatility_rank"] < 0)
            | (df["volatility_rank"] > 1)
        ).any():
            raise ValueError(
                "Volatility Rank must be between 0 and 1."
            )

    def _validate_columns(self, df):
        """
        Ensure all required columns exist.
        """

        missing = [
            col
            for col in self.REQUIRED_COLUMNS
            if col not in df.columns
        ]

        if missing:
            raise ValueError(
                f"Missing required columns:\n{missing}"
            )