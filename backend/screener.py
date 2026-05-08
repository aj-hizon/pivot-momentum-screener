import asyncio
import aiohttp
import time
import traceback

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

    global cached_symbols
    global symbols_cache_time

    now = time.time()

    # CACHE HIT
    if now - symbols_cache_time < SYMBOL_CACHE_DURATION:
        print(f"Using cached symbols: {len(cached_symbols)}")
        return cached_symbols

    url = f"{BASE_URL}/v5/market/instruments-info"

    symbols = []
    cursor = None

    print("FETCHING SYMBOLS FROM BYBIT...")

    try:

        while True:

            params = {
                "category": "linear",
                "limit": 1000
            }

            if cursor:
                params["cursor"] = cursor

            print("REQUESTING:", params)

            async with shared_session.get(
                url,
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as res:

                print("SYMBOL STATUS:", res.status)

                raw_text = await res.text()

                print("RAW RESPONSE PREVIEW:")
                print(raw_text[:300])

                if res.status != 200:
                    print("FAILED SYMBOL REQUEST")
                    break

                try:
                    data = await res.json()
                except Exception:
                    print("JSON PARSE FAILED")
                    break

            result = data.get("result", {})

            items = result.get("list", [])

            print(f"RECEIVED {len(items)} SYMBOLS")

            if not items:
                print("NO ITEMS RETURNED")
                break

            for item in items:

                symbol = item.get("symbol")

                if (
                    symbol
                    and symbol.endswith("USDT")
                    and item.get("status") == "Trading"
                ):
                    symbols.append(symbol)

            cursor = result.get("nextPageCursor")

            print("NEXT CURSOR:", cursor)

            if not cursor:
                break

    except Exception:
        print("GET SYMBOLS CRASHED:")
        traceback.print_exc()

    cached_symbols = symbols
    symbols_cache_time = time.time()

    print(f"FINAL SYMBOL COUNT: {len(symbols)}")

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
                params=params,
                timeout=aiohttp.ClientTimeout(total=8)
            ) as res:

                if res.status != 200:

                    print(f"{symbol} HTTP {res.status}")

                    await asyncio.sleep(0.2)

                    continue

                data = await res.json()

            candles = data.get(
                "result",
                {}
            ).get("list", [])

            if not candles:

                print(f"{symbol} EMPTY CANDLES")

                return symbol, None

            candles.reverse()

            # SAVE CACHE
            klines_cache[cache_key] = (
                now,
                candles
            )

            return symbol, candles

        except Exception as e:

            print(f"{symbol} ERROR: {str(e)}")

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

        print("RETURNING CACHE:", len(cached_screener))

        return cached_screener

    # PREVENT MULTIPLE FULL SCANS
    async with screener_lock:

        now = time.time()

        if now - screener_cache_time < SCREENER_CACHE_DURATION:

            print("RETURNING CACHE AFTER LOCK:", len(cached_screener))

            return cached_screener

        start = time.perf_counter()

        symbols = await get_symbols()

        print(f"SYMBOLS TO SCAN: {len(symbols)}")

        if not symbols:
            print("NO SYMBOLS AVAILABLE")
            return []

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

                    print(f"EMA TOUCH FOUND: {sym}")

                    coins.append({
                        "symbol": sym,
                        "close": closes[-1],
                        "ema21": round(current_ema, 4),
                    })

            except Exception as e:

                print(f"{sym} PROCESSING ERROR: {str(e)}")

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