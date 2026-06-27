"""Download raw OHLC data from Yahoo Finance and save to data/raw/."""

import yfinance as yf
from pathlib import Path

PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF","GOLD"]
RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

for pair in PAIRS:
    ticker = pair + "=X"
    df = yf.download(ticker, period="10y", interval="1d", auto_adjust=False)
    if df.empty:
        print(f"Failed to download {pair}")
        continue
    # Keep only OHLC and Date
    df = df[['Open','High','Low','Close']].reset_index()
    df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
    df.to_csv(RAW_DIR / f"{pair}.csv", index=False)
    print(f"Saved {pair}.csv ({len(df)} rows)")