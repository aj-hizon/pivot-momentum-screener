from backend import screener


def test_should_include_coin_requires_price_at_or_above_hourly_ema():
    assert screener.should_include_coin(100, 90, 50, 60) is True
    assert screener.should_include_coin(90, 100, 50, 60) is False
    assert screener.should_include_coin(100, 90, 60, 50) is False
    assert screener.should_include_coin(90, 90, 50, 60) is True
