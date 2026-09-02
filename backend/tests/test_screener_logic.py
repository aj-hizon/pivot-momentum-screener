import asyncio

from backend import screener


def test_run_screener_waits_for_inflight_refresh():
    async def run_inner():
        original_cached = screener.cached_screener
        original_task = screener.refresh_task
        screener.cached_screener = []

        async def fake_refresh():
            return [{"symbol": "BTCUSDT"}]

        screener.refresh_task = asyncio.create_task(fake_refresh())

        try:
            result = await screener.run_screener()
            assert result == [{"symbol": "BTCUSDT"}]
        finally:
            screener.refresh_task = original_task
            screener.cached_screener = original_cached

    asyncio.run(run_inner())


def test_below_21_ema_category_requires_daily_ema21_less_than_1h_close_with_3pct_distance():
    # close_1h=100, ema21_1h=100, ema21_d=94 -> distance = (100-94)/100 * 100 = 6% >= 3% ✓
    assert screener.is_below_21_ema(100, 100, 500_000, close_d=None, ema21_d=94) is True
    # With close_d and ema21_d provided, same test
    assert screener.is_below_21_ema(100, 100, 500_000, close_d=50, ema21_d=94) is True
    # close_1h=110, ema21_1h=100 -> 1h close above ema21, fails
    assert screener.is_below_21_ema(110, 100, 500_000, close_d=50, ema21_d=94) is False
    # volume too low
    assert screener.is_below_21_ema(100, 100, 499_999, close_d=50, ema21_d=94) is False
    # ema21_d >= close_1h, fails
    assert screener.is_below_21_ema(100, 100, 500_000, close_d=50, ema21_d=100) is False
    # ema21_d=97 -> distance = (100-97)/100 * 100 = 3% >= 3% ✓
    assert screener.is_below_21_ema(100, 100, 500_000, close_d=50, ema21_d=97) is True
    # ema21_d=98 -> distance = (100-98)/100 * 100 = 2% < 3% ✗
    assert screener.is_below_21_ema(100, 100, 500_000, close_d=50, ema21_d=98) is False


def test_has_green_daily_candle_requires_current_or_recent_green_candle():
    green = [["0", "10", "12", "9", "11", "100"]]
    mixed = [["0", "10", "12", "9", "9", "100"], ["0", "10", "12", "9", "11", "100"]]
    red = [["0", "10", "12", "9", "9", "100"], ["0", "10", "12", "9", "9", "100"]]

    assert screener.has_green_daily_candle(green) is True
    assert screener.has_green_daily_candle(mixed) is True
    assert screener.has_green_daily_candle(red) is False


def test_should_include_coin_requires_original_criteria_plus_green_daily_candle():
    green_daily = [
        ["0", "10", "12", "9", "11", "1_000_000"],
        ["0", "10", "12", "9", "9", "1_000_000"],
        ["0", "10", "12", "9", "9", "1_000_000"],
        ["0", "10", "12", "9", "9", "1_000_000"],
    ]
    red_daily = [
        ["0", "10", "12", "9", "9", "1_000_000"],
        ["0", "10", "12", "9", "9", "1_000_000"],
        ["0", "10", "12", "9", "9", "1_000_000"],
        ["0", "10", "12", "9", "9", "1_000_000"],
    ]

    assert screener.should_include_coin(100, 90, 50, 60, 1_500_000, candles_d=green_daily) is True
    assert screener.should_include_coin(100, 90, 59, 60, 2_000_000, candles_d=green_daily) is True
    assert screener.should_include_coin(90, 100, 50, 60, 2_000_000, candles_d=green_daily) is False
    assert screener.should_include_coin(100, 90, 60, 50, 2_000_000, candles_d=green_daily) is False
    assert screener.should_include_coin(100, 90, 50, 60, 499_999, candles_d=green_daily) is False
    assert screener.should_include_coin(100, 90, 50, 60, 1_500_000, candles_d=red_daily) is False
