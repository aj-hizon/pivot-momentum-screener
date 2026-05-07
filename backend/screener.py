import asyncio
import aiohttp
import time
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "https://api.bybit.com"

cached_symbols = None
cache_time = 0
CACHE_DURATION = 3600  # 1 hour


# ---------------------------
# GET ALL SYMBOLS
# ---------------------------
async def get_symbols(session):
    global cached_symbols, cache_time

    current_time = time.time()

    if cached_symbols and (current_time - cache_time) < CACHE_DURATION:
        print(f"Using cached symbols: {len(cached_symbols)} symbols")
        return cached_symbols

    url = f"{BASE_URL}/v5/market/instruments-info"

    all_symbols = []
    cursor = None

    while True:
        params = {
            "category": "linear",
            "limit": 1000
        }

        if cursor:
            params["cursor"] = cursor

        try:
            async with session.get(url, params=params) as res:
                data = await res.json()

        except Exception as e:
            print(f"Error fetching symbols: {e}")
            break

        if data.get("retCode") != 0:
            print("API error while fetching symbols")
            break

        result = data.get("result", {})
        items = result.get("list", [])

        if not items:
            break

        for item in items:
            symbol = item.get("symbol")

            if not symbol:
                continue

            if not symbol.endswith("USDT"):
                continue

            if item.get("status") != "Trading":
                continue

            all_symbols.append(symbol)

        cursor = result.get("nextPageCursor")

        if not cursor:
            break

    print(f"Fetched {len(all_symbols)} USDT perpetuals")

    cached_symbols = all_symbols
    cache_time = current_time

    return all_symbols


# ---------------------------
# GET KLINES (FIXED + RETRY + BACKOFF)
# ---------------------------
async def get_klines(session, symbol, interval="240"):
    url = f"{BASE_URL}/v5/market/kline"

    params = {
        "category": "linear",
        "symbol": symbol,
        "interval": interval,
        "limit": 200
    }

    for attempt in range(3):
        try:
            async with session.get(
                url,
                params=params,
                timeout=aiohttp.ClientTimeout(total=6)
            ) as res:

                if res.status == 403:
                    print(f"{symbol} 403 retry {attempt + 1}")
                    await asyncio.sleep(0.4 * (attempt + 1))
                    continue

                if res.status != 200:
                    print(f"{symbol} HTTP {res.status}")
                    return symbol, None

                data = await res.json()

            candles = data.get("result", {}).get("list", [])

            if not candles:
                return symbol, None

            candles = list(reversed(candles))

            return symbol, candles

        except asyncio.TimeoutError:
            print(f"{symbol} timeout retry {attempt + 1}")
            await asyncio.sleep(0.3 * (attempt + 1))

        except Exception as e:
            print(f"{symbol} error {e}")
            await asyncio.sleep(0.3 * (attempt + 1))

    return symbol, None


# ---------------------------
# EMA SERIES
# ---------------------------
def ema_series(closes, period=21):
    if len(closes) < period:
        return []

    multiplier = 2 / (period + 1)

    ema_values = []

    sma = sum(closes[:period]) / period
    ema_values = [None] * (period - 1)
    ema_values.append(sma)

    previous_ema = sma

    for close in closes[period:]:
        previous_ema = (close - previous_ema) * multiplier + previous_ema
        ema_values.append(previous_ema)

    return ema_values


# ---------------------------
# TOUCH CHECK
# ---------------------------
def touched_ema(candle, ema_value):
    if ema_value is None:
        return False

    high = float(candle[2])
    low = float(candle[3])

    return low <= ema_value <= high


# ---------------------------
# SCREENER
# ---------------------------
async def run_screener():
    start = time.perf_counter()

    try:
        async with aiohttp.ClientSession() as session:
            symbols = await get_symbols(session)

            print(f"\nScanning {len(symbols)} coins...\n")

            semaphore = asyncio.Semaphore(8)  # FIXED (was 20 → too aggressive)

            async def limited(symbol):
                async with semaphore:
                    await asyncio.sleep(0.05)  # smooth rate
                    return await get_klines(session, symbol)

            tasks = [limited(sym) for sym in symbols]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            coins = []

            for result in results:
                if isinstance(result, Exception):
                    continue

                sym, candles = result

                if not candles or len(candles) < 50:
                    continue

                closes = [float(c[4]) for c in candles]

                ema21_values = ema_series(closes, 21)

                if len(ema21_values) < 2:
                    continue

                current_candle = candles[-1]
                previous_candle = candles[-2]

                current_ema = ema21_values[-1]
                previous_ema = ema21_values[-2]

                touched = (
                    touched_ema(current_candle, current_ema)
                    or touched_ema(previous_candle, previous_ema)
                )

                if not touched:
                    continue

                coins.append({
                    "symbol": sym,
                    "close": closes[-1],
                    "ema21": current_ema,
                    "touched_21ema": True
                })

        end = time.perf_counter()

        print(f"\nCoins touching 21 EMA: {len(coins)}")
        print(f"Time: {end - start:.2f}s")

        return coins

    except Exception as e:
        print(f"Screener error: {e}")
        return []


# ---------------------------
# MAIN
# ---------------------------
if __name__ == "__main__":
    asyncio.run(run_screener())