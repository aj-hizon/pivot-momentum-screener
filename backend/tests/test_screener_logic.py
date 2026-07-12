from backend import screener


def test_should_include_coin_requires_price_at_or_above_hourly_ema_and_min_daily_distance_and_volume():
    assert screener.should_include_coin(100, 90, 50, 60, 1_500_000) is True
    assert screener.should_include_coin(100, 90, 59, 60, 2_000_000) is False
    assert screener.should_include_coin(90, 100, 50, 60, 2_000_000) is False
    assert screener.should_include_coin(100, 90, 60, 50, 2_000_000) is False
    assert screener.should_include_coin(90, 90, 50, 60, 2_000_000) is True
    assert screener.should_include_coin(100, 90, 50, 60, 500_000) is False
