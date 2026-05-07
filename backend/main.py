from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import aiohttp

from screener import run_screener, get_klines

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# SCREENER
# ---------------------------
@app.get("/screener")
async def screener():
    try:
        return await run_screener()
    except Exception as e:
        print(f"Screener error: {e}")
        return []


# ---------------------------
# KLINES
# ---------------------------
@app.get("/klines")
async def klines(symbol: str, interval: str = "240"):
    try:
        async with aiohttp.ClientSession() as session:
            _, candles = await get_klines(session, symbol, interval)
            return candles or []
    except Exception as e:
        print(f"Klines error for {symbol}: {e}")
        return []