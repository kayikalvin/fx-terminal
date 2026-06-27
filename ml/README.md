# FX Research Terminal ML Backend

Place raw OHLC CSV files (columns: Date, Open, High, Low, Close) in `data/raw/`.
Run `python train.py` to:
- Build a feature‑rich dataset
- Train a logistic regression model
- Evaluate using time‑series cross‑validation
- Export `model.json` for the React frontend.