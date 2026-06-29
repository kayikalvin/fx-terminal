"""Bridge between MetaTrader 5 and the FX Research Terminal."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import MetaTrader5 as mt5
from datetime import datetime

app = FastAPI(title="MT5 Bridge")

# Allow all origins (local development)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Initialise MT5 connection
def init_mt5():
    if not mt5.initialize():
        raise Exception(f"MT5 initialisation failed: {mt5.last_error()}")
    print("MT5 initialised successfully.")

init_mt5()

@app.get("/health")
def health():
    acc = mt5.account_info()
    if acc is None:
        return {"status": "error", "message": str(mt5.last_error())}
    return {"status": "connected", "account": acc.login, "balance": acc.balance}

@app.get("/price/{symbol}")
def live_price(symbol: str):
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    return {"symbol": symbol, "bid": tick.bid, "ask": tick.ask, "time": datetime.now().isoformat()}

@app.get("/history/{symbol}")
def historical_ohlc(symbol: str, timeframe: str = "D", bars: int = 500):
    tf_map = {
        "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
        "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
        "D": mt5.TIMEFRAME_D1, "W": mt5.TIMEFRAME_W1, "MN": mt5.TIMEFRAME_MN1,
    }
    tf = tf_map.get(timeframe, mt5.TIMEFRAME_D1)
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, bars)
    if rates is None or len(rates) == 0:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    import pandas as pd
    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    return df.rename(columns={'time': 'Date', 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'tick_volume': 'Volume'})[['Date','Open','High','Low','Close','Volume']].to_dict(orient='records')