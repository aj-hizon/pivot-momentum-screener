import asyncio
import sys
import aiohttp
sys.path.insert(0, '.')
import screener

async def test():
    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout, headers={'User-Agent':'test'}) as session:
        screener.set_shared_session(session)
        symbols = await screener.get_symbols()
        print('symbols', len(symbols), symbols[:10])
        count = 0
        for sym in symbols[:10]:
            _, candles_1h = await screener.get_klines(session, sym, interval='60', limit=200)
            _, candles_daily = await screener.get_klines(session, sym, interval='D', limit=30)
            print('SYMBOL', sym, '1h', bool(candles_1h), 'daily', bool(candles_daily), '1h_len', len(candles_1h) if candles_1h else 0, 'daily_len', len(candles_daily) if candles_daily else 0)
            if not candles_1h or not candles_daily:
                continue
            _, curr1, last1 = screener.ema_from_candles(candles_1h, 21)
            _, currd, lastd = screener.ema_from_candles(candles_daily, 5)
            print('  curr1', curr1, 'last1', last1, 'currd', currd, 'lastd', lastd)
            if curr1 is None or currd is None:
                continue
            touched1 = any(screener.touched(candles_1h[-(i+1)], curr1) for i in range(6))
            trend = 'above' if last1 >= curr1 else 'below'
            include = (trend == 'above' and lastd < currd) or (trend == 'below' and lastd > currd)
            print('  touched1', touched1, 'trend', trend, 'include', include)
            if touched1 and include:
                count += 1
        print('matches', count)

if __name__ == '__main__':
    asyncio.run(test())
