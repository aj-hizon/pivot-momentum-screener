import asyncio
import aiohttp
import time

BASE_URL = "https://api.bybit.com"

shared_session = None

cached_symbols = []
symbols_cache_time = 0

cached_screener = []
screener_cache_time = 0

klines_cache = {}

SYMBOL_CACHE_DURATION = 3600
SCREENER_CACHE_DURATION = 30
KLINES_CACHE_DURATION = 15

screener_lock = asyncio.Lock()

SEMAPHORE_LIMIT = 25  # optimized for local server


def set_shared_session(session):
    global shared_session
    shared_session = session


# ---------------------------
# SYMBOLS
# ---------------------------


async def get_symbols():

    global cached_symbols, symbols_cache_time

    now = time.time()

    # Cache layer
    if cached_symbols and (now - symbols_cache_time) < SYMBOL_CACHE_DURATION:
        return cached_symbols

    url = f"{BASE_URL}/v5/market/instruments-info"

    symbols = []
    cursor = None

    # retry wrapper for full function (extra safety)
    for attempt in range(5):

        try:
            while True:

                params = {
                    "category": "linear",
                    "limit": 1000
                }

                if cursor:
                    params["cursor"] = cursor

                # SAFE REQUEST BLOCK
                try:
                    async with shared_session.get(
                        url,
                        params=params,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as res:

                        if res.status != 200:
                            print(f"[Bybit] HTTP {res.status}, retrying...")
                            await asyncio.sleep(2)
                            continue

                        data = await res.json()

                except Exception as e:
                    print(f"[Bybit request error] {e}, retrying...")
                    await asyncio.sleep(2)
                    continue

                result = data.get("result", {})
                items = result.get("list", [])

                if not items:
                    break

                for item in items:
                    sym = item.get("symbol")

                    if sym and sym.endswith("USDT") and item.get("status") == "Trading":
                        symbols.append(sym)

                cursor = result.get("nextPageCursor")

                if not cursor:
                    break

            # SUCCESS → update cache
            cached_symbols = symbols
            symbols_cache_time = now

            print(f"[Symbols] fetched: {len(symbols)}")

            return symbols

        except Exception as e:
            print(f"[get_symbols retry {attempt+1}/5 failed]: {e}")
            await asyncio.sleep(3)

    # FINAL FALLBACK (never crash screener)
    print("[get_symbols] FAILED → returning cached or empty list")

    return cached_symbols or []


# ---------------------------
# KLINES
# ---------------------------

async def get_klines(session, symbol, interval="240", limit=60):

    cache_key = f"{symbol}_{interval}_{limit}"
    now = time.time()

    if cache_key in klines_cache:
        t, data = klines_cache[cache_key]
        if now - t < KLINES_CACHE_DURATION:
            return symbol, data

    url = f"{BASE_URL}/v5/market/kline"

    params = {
        "category": "linear",
        "symbol": symbol,
        "interval": interval,
        "limit": limit
    }

    try:
        async with session.get(url, params=params) as res:

            if res.status != 200:
                return symbol, None

            data = await res.json()

        candles = data.get("result", {}).get("list", [])

        if not candles:
            return symbol, None

        candles.reverse()

        klines_cache[cache_key] = (now, candles)

        return symbol, candles

    except:
        return symbol, None


# ---------------------------
# EMA (FAST - NO ALLOCATION)
# ---------------------------

def ema21_from_candles(candles):

    period = 21

    if len(candles) < period:
        return None, None, None

    multiplier = 2 / (period + 1)

    sma = 0.0
    for i in range(period):
        sma += float(candles[i][4])

    ema = sma / period
    prev = ema

    for c in candles[period:-1]:
        close = float(c[4])
        prev = (close - prev) * multiplier + prev

    last_close = float(candles[-1][4])
    current = (last_close - prev) * multiplier + prev

    return prev, current, last_close


def touched(candle, ema):
    high = float(candle[2])
    low = float(candle[3])
    return low <= ema <= high


# ---------------------------
# SCREENER
# ---------------------------

async def run_screener():

    global cached_screener, screener_cache_time

    now = time.time()

    if now - screener_cache_time < SCREENER_CACHE_DURATION:
        return cached_screener

    async with screener_lock:

        now = time.time()

        if now - screener_cache_time < SCREENER_CACHE_DURATION:
            return cached_screener

        symbols = await get_symbols()

        if not symbols:
            return []

        semaphore = asyncio.Semaphore(SEMAPHORE_LIMIT)

        async def worker(sym):
            async with semaphore:
                return await get_klines(shared_session, sym)

        tasks = [asyncio.create_task(worker(s)) for s in symbols]

        coins = []

        for task in asyncio.as_completed(tasks):

            sym, candles = await task

            if not candles:
                continue

            try:
                prev_ema, curr_ema, last_close = ema21_from_candles(candles)

                if prev_ema is None:
                    continue

                if (
                    touched(candles[-1], curr_ema)
                    or touched(candles[-2], prev_ema)
                ):
                    coins.append({
                        "symbol": sym,
                        "close": last_close,
                        "ema21": round(curr_ema, 4),
                    })

            except:
                continue

        cached_screener = coins
        screener_cache_time = time.time()

        return coins