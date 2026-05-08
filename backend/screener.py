import asyncio
import aiohttp
import time

BASE_URL = "https://api.bybit.com"

# ---------------------------
# GLOBALS
# ---------------------------

shared_session = None

cached_symbols = []
symbols_cache_time = 0

cached_screener = []
screener_cache_time = 0

klines_cache = {}

SYMBOL_CACHE_DURATION = 3600
SCREENER_CACHE_DURATION = 30
KLINES_CACHE_DURATION = 15

# prevents multiple scans at once
screener_lock = asyncio.Lock()

# safer for Render free tier
SEMAPHORE_LIMIT = 10


# ---------------------------
# SET SESSION
# ---------------------------

def set_shared_session(session):
    global shared_session
    shared_session = session


# ---------------------------
# GET SYMBOLS
# ---------------------------

async def get_symbols():
    global cached_symbols, symbols_cache_time

    now = time.time()

    if now - symbols_cache_time < SYMBOL_CACHE_DURATION:
        return cached_symbols

    url = f"{BASE_URL}/v5/market/instruments-info"

    symbols = []
    cursor = None

    try:
        while True:

            params = {
                "category": "linear",
                "limit": 1000
            }

            if cursor:
                params["cursor"] = cursor

            async with shared_session.get(
                url,
                params=params
            ) as res:

                if res.status != 200:
                    break

                data = await res.json()

            items = data.get("result", {}).get("list", [])

            for item in items:
                symbol = item.get("symbol")

                if (
                    symbol
                    and symbol.endswith("USDT")
                    and item.get("status") == "Trading"
                ):
                    symbols.append(symbol)

            cursor = data.get(
                "result",
                {}
            ).get("nextPageCursor")

            if not cursor:
                break

    except Exception as e:
        print(f"Symbols error: {e}")

    cached_symbols = symbols
    symbols_cache_time = now

    print(f"Loaded {len(symbols)} symbols")

    return symbols


# ---------------------------
# GET KLINES
# ---------------------------

async def get_klines(session, symbol, interval="240"):

    cache_key = f"{symbol}_{interval}"

    now = time.time()

    # CACHE HIT
    if cache_key in klines_cache:

        cached_time, cached_data = klines_cache[cache_key]

        if now - cached_time < KLINES_CACHE_DURATION:
            return symbol, cached_data

    url = f"{BASE_URL}/v5/market/kline"

    params = {
        "category": "linear",
        "symbol": symbol,
        "interval": interval,
        "limit": 60
    }

    for attempt in range(2):

        try:
            async with session.get(
                url,
                params=params
            ) as res:

                if res.status != 200:

                    await asyncio.sleep(0.2)

                    continue

                data = await res.json()

            candles = data.get(
                "result",
                {}
            ).get("list", [])

            if not candles:
                return symbol, None

            candles.reverse()

            # SAVE CACHE
            klines_cache[cache_key] = (
                now,
                candles
            )

            return symbol, candles

        except Exception:
            await asyncio.sleep(0.2)

    return symbol, None


# ---------------------------
# FAST EMA
# ---------------------------

def ema21(closes):

    period = 21

    if len(closes) < period:
        return None, None

    multiplier = 2 / (period + 1)

    ema = sum(closes[:period]) / period

    previous_ema = ema

    for close in closes[period:-1]:

        previous_ema = (
            (close - previous_ema)
            * multiplier
            + previous_ema
        )

    current_ema = (
        (closes[-1] - previous_ema)
        * multiplier
        + previous_ema
    )

    return previous_ema, current_ema


# ---------------------------
# TOUCH CHECK
# ---------------------------

def touched(candle, ema):

    high = float(candle[2])
    low = float(candle[3])

    return low <= ema <= high


# ---------------------------
# SCREENER
# ---------------------------

async def run_screener():

    print("SCREENER RUNNING - NOT CACHE")
    
    global cached_screener
    global screener_cache_time

    now = time.time()

    # RETURN CACHE
    if now - screener_cache_time < SCREENER_CACHE_DURATION:
        return cached_screener

    # PREVENT MULTIPLE FULL SCANS
    async with screener_lock:

        # another request may already updated cache
        now = time.time()

        if now - screener_cache_time < SCREENER_CACHE_DURATION:
            return cached_screener

        start = time.perf_counter()

        symbols = await get_symbols()

        semaphore = asyncio.Semaphore(SEMAPHORE_LIMIT)

        async def worker(symbol):

            async with semaphore:

                return await get_klines(
                    shared_session,
                    symbol
                )

        tasks = [worker(sym) for sym in symbols]

        results = await asyncio.gather(
            *tasks,
            return_exceptions=False
        )

        coins = []

        for sym, candles in results:

            if not candles:
                continue

            try:
                closes = [float(c[4]) for c in candles]

                previous_ema, current_ema = ema21(closes)

                if previous_ema is None:
                    continue

                current_candle = candles[-1]
                previous_candle = candles[-2]

                if (
                    touched(current_candle, current_ema)
                    or touched(previous_candle, previous_ema)
                ):

                    coins.append({
                        "symbol": sym,
                        "close": closes[-1],
                        "ema21": round(current_ema, 4),
                    })

            except:
                continue

        elapsed = time.perf_counter() - start

        print(
            f"Scanned {len(symbols)} coins | "
            f"Found {len(coins)} | "
            f"{elapsed:.2f}s"
        )

        cached_screener = coins
        screener_cache_time = time.time()

        print("RETURNING CACHE:", len(cached_screener))
        return coins