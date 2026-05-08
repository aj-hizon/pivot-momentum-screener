from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

import aiohttp
import asyncio

from screener import (
    run_screener,
    get_klines,
    set_shared_session,
)

# ---------------------------
# GLOBALS
# ---------------------------

session = None


# ---------------------------
# STARTUP / SHUTDOWN
# ---------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):

    global session

    connector = aiohttp.TCPConnector(
        limit=50,
        limit_per_host=20,
        ttl_dns_cache=300,
        enable_cleanup_closed=True,
        ssl=False
    )

    timeout = aiohttp.ClientTimeout(
        total=6
    )

    session = aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        headers={
            "User-Agent": "screener-app"
        }
    )

    set_shared_session(session)

    print("Session started")

    # warm screener cache
    asyncio.create_task(run_screener())

    yield

    await session.close()

    print("Session closed")


app = FastAPI(
    lifespan=lifespan
)

# ---------------------------
# MIDDLEWARE
# ---------------------------

app.add_middleware(
    GZipMiddleware,
    minimum_size=1000
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# ROUTES
# ---------------------------

@app.get("/")

async def root():
    return {
        "status": "running"
    }


@app.get("/screener")

async def screener():
    return await run_screener()


@app.get("/klines")

async def klines(
    symbol: str,
    interval: str = "240"
):

    _, candles = await get_klines(
        session,
        symbol,
        interval
    )

    return candles or []