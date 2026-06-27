"""Feature engineering for each pair."""

import pandas as pd
import numpy as np
from typing import Optional

class FeatureEngineer:
    """Creates features and target from raw OHLC data."""

    def __init__(self, df: pd.DataFrame) -> None:
        self.df = df.copy()
        self.feature_names = []   # populated after generate_features()

    def generate_features(self) -> pd.DataFrame:
        """Apply all feature methods and return DataFrame with features + target."""
        df = self.df
        # Price-based indicators
        df["rsi_14"] = self._rsi(df["Close"], 14)
        df["sma_20"] = df["Close"].rolling(20).mean()
        df["sma_50"] = df["Close"].rolling(50).mean()
        df["ema_20"] = df["Close"].ewm(span=20, adjust=False).mean()
        df["atr_14"] = self._atr(df, 14)
        # Distances
        df["sma20_dist"] = (df["Close"] - df["sma_20"]) / df["Close"]
        df["sma50_dist"] = (df["Close"] - df["sma_50"]) / df["Close"]
        df["ema20_dist"] = (df["Close"] - df["ema_20"]) / df["Close"]
        # Returns
        df["daily_return"] = df["Close"].pct_change()
        df["weekly_return"] = df["Close"].pct_change(5)
        df["monthly_return"] = df["Close"].pct_change(21)
        # Momentum
        df["momentum"] = df["Close"] - df["Close"].shift(10)
        # Rolling volatility (20-day)
        df["rolling_volatility"] = df["daily_return"].rolling(20).std()
        # ATR percentage
        df["atr_pct"] = df["atr_14"] / df["Close"]
        # Trend (1 if SMA20 > SMA50)
        df["trend"] = (df["sma_20"] > df["sma_50"]).astype(int)
        # Volatility percentile (20-day)
        df["volatility_percentile"] = (
            df["rolling_volatility"]
            .rolling(20)
            .apply(lambda x: (x.iloc[-1] < x).mean() * 100, raw=False)
        )
        # Price position within 20-day range
        rolling_high = df["High"].rolling(20).max()
        rolling_low = df["Low"].rolling(20).min()
        df["price_position"] = (df["Close"] - rolling_low) / (rolling_high - rolling_low + 1e-9)
        df["rolling_high"] = rolling_high
        df["rolling_low"] = rolling_low
        # Target: tomorrow close > today close
        df["target"] = (df["Close"].shift(-1) > df["Close"]).astype(int)

        # Drop rows with NaN created by rolling windows
        df = df.dropna()
        # Store feature names (excluding 'target' and non-feature columns)
        non_features = ["Date", "Open", "High", "Low", "Close", "target",
                        "rolling_high", "rolling_low"]
        self.feature_names = [col for col in df.columns if col not in non_features]
        return df

    @staticmethod
    def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    @staticmethod
    def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        high, low, close = df["High"], df["Low"], df["Close"]
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(period).mean()