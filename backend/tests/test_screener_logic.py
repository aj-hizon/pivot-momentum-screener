from backend import screener


def test_below_21_ema_category_includes_price_at_or_below_hourly_ema():
    assert screener.is_below_21_ema(90, 100, 500_000) is True
    assert screener.is_below_21_ema(100, 100, 500_000) is True
    assert screener.is_below_21_ema(110, 100, 500_000) is False
    assert screener.is_below_21_ema(90, 100, 499_999) is False


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
