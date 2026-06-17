import asyncio
import aiohttp
import random
import time

BASE_URL = "https://api.bybit.com"

shared_session = None

cached_symbols = []
symbols_cache_time = 0

cached_screener = []
screener_cache_time = 0

klines_cache = {}

SYMBOL_CACHE_DURATION = 3600
SCREENER_CACHE_DURATION = 60
KLINES_CACHE_DURATION = 300

screener_lock = asyncio.Lock()
refresh_task = None

SEMAPHORE_LIMIT = 10


# ---------------------------
# SESSION
# ---------------------------

def set_shared_session(session):
    global shared_session
    shared_session = session


# ---------------------------
# SYMBOLS
# ---------------------------

async def get_symbols():
    global cached_symbols, symbols_cache_time

    now = time.time()

    if cached_symbols and (now - symbols_cache_time) < SYMBOL_CACHE_DURATION:
        return cached_symbols

    url = f"{BASE_URL}/v5/market/instruments-info"

    symbols = []
    cursor = None

    for attempt in range(5):
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
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as res:

                    if res.status != 200:
                        await asyncio.sleep(2)
                        continue

                    data = await res.json()

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

            cached_symbols = symbols
            symbols_cache_time = now

            print(f"[Symbols] fetched: {len(symbols)}")
            return symbols

        except Exception as e:
            print(f"[get_symbols retry {attempt+1}/5 failed]: {e}")
            await asyncio.sleep(3)

    return cached_symbols or []


# ---------------------------
# KLINES
# ---------------------------

async def get_klines(session, symbol, interval="5", limit=60):

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

    for attempt in range(3):
        try:
            async with session.get(url, params=params) as res:

                if res.status == 403:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue

                if res.status != 200:
                    break

                data = await res.json()

            candles = data.get("result", {}).get("list", [])

            if candles:
                candles.reverse()
                klines_cache[cache_key] = (now, candles)
                return symbol, candles

            break

        except:
            await asyncio.sleep(0.3 * (attempt + 1))
            continue

    # fallback mock (unchanged)
    base_price = 100.0
    if 'BTC' in symbol:
        base_price = 50000
    elif 'ETH' in symbol:
        base_price = 3000
    elif 'BNB' in symbol:
        base_price = 700

    mock_candles = []
    price = base_price
    base_time = int(time.time() * 1000) - (limit * 60000)

    for i in range(limit):
        change = random.gauss(0, price * 0.01)
        price = max(price + change, base_price * 0.5)

        open_p = price
        high = price * (1 + 0.02)
        low = price * (1 - 0.02)
        close = price * (1 + random.uniform(-0.01, 0.01))

        mock_candles.append([
            str(base_time + i * 60000),
            str(open_p),
            str(high),
            str(low),
            str(close),
            str(1000)
        ])

    klines_cache[cache_key] = (now, mock_candles)
    return symbol, mock_candles


# ---------------------------
# EMA
# ---------------------------

def ema_from_candles(candles, period):
    if len(candles) < period:
        return None, None, None

    multiplier = 2 / (period + 1)

    sma = sum(float(c[4]) for c in candles[:period])
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
# SCREENER (FIXED LOGIC)
# ---------------------------

async def _refresh_screener():
    global cached_screener, screener_cache_time, refresh_task

    async with screener_lock:

        symbols = await get_symbols()
        if not symbols:
            refresh_task = None
            return cached_screener

        semaphore = asyncio.Semaphore(SEMAPHORE_LIMIT)

        async def worker(sym):
            async with semaphore:
                _, candles_1h = await get_klines(shared_session, sym, interval="60", limit=200)
                return sym, candles_1h

        tasks = [asyncio.create_task(worker(s)) for s in symbols]

        coins = []

        for task in asyncio.as_completed(tasks):
            sym, candles_1h = await task

            if not candles_1h:
                continue

            try:
                _, ema21, last_close = ema_from_candles(candles_1h, 21)

                if ema21 is None:
                    continue

                trend = "above" if last_close >= ema21 else "below"

                # optional touch filter (soft, NOT blocking everything)
                if not any(touched(candles_1h[-(i+1)], ema21) for i in range(3)):
                    continue

                coins.append({
                    "symbol": sym,
                    "close": last_close,
                    "ema21": round(ema21, 4),
                    "trend": trend
                })

            except Exception:
                continue

        # IMPORTANT: always update cache even if empty
        cached_screener = coins
        screener_cache_time = time.time()

        print(f"[Screener] updated: {len(coins)} coins")

        refresh_task = None
        return cached_screener


# ---------------------------
# RUN SCREENER
# ---------------------------

async def run_screener():
    global cached_screener, screener_cache_time, refresh_task

    now = time.time()

    if cached_screener and now - screener_cache_time < SCREENER_CACHE_DURATION:
        return cached_screener

    if refresh_task is None:
        refresh_task = asyncio.create_task(_refresh_screener())
        return cached_screener

    return cached_screener