import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import Chart from "./Chart";
import { prefetchKlines } from "./chartCache";

export default function MobileSwiper({
  coins,
  selectedIndex,
  onSelect,
  timeframe,
  onTimeframeChange,
  filter,
  onFilterChange,
}) {
  const [inverted, setInverted] = useState(false);

  // SAFE INDEX
  const safeIndex =
    coins && coins.length > 0 ? Math.min(selectedIndex, coins.length - 1) : 0;

  const selectedCoin = coins?.[safeIndex];

  // PREFETCH
  useEffect(() => {
    if (!coins || coins.length === 0) return;

    const current = coins[safeIndex];
    if (!current) return;

    const neighbors = [coins[safeIndex - 1], coins[safeIndex + 1]]
      .filter(Boolean)
      .map((c) => c.symbol);

    prefetchKlines(current.symbol, timeframe);
    neighbors.forEach((symbol) => prefetchKlines(symbol, timeframe));
  }, [coins, safeIndex, timeframe]);

  if (!coins || coins.length === 0) {
    return (
      <div
        style={{
          height: "100vh",
          background: "#000",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        No coins match filter
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        background: "#000",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------------- CONTROLS ---------------- */}
      <div
        style={{
          background: "#111",
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          gap: 10,
        }}
      >
        {/* FILTER */}
        <select
          value={filter}
          onChange={(e) => {
            onFilterChange(e.target.value);
            onSelect(0);
          }}
          style={{
            background: "#1f1f1f",
            color: "white",
            border: "none",
            padding: 6,
            borderRadius: 4,
            flex: 1,
          }}
        >
          <option value="all">All Coins</option>
          <option value="above21ema">Above 21 EMA</option>
        </select>

        {/* TIMEFRAME DROPDOWN (FIX) */}
        <select
          value={timeframe}
          onChange={(e) => onTimeframeChange(e.target.value)}
          style={{
            background: "#1f1f1f",
            color: "white",
            border: "none",
            padding: 6,
            borderRadius: 4,
            flex: 1,
          }}
        >
          <option value="5">5M</option>
          <option value="60">1H</option>
          <option value="240">4H</option>
          <option value="D">1D</option>
          <option value="W">1W</option>
        </select>

        {/* INVERT */}
        <button
          onClick={() => setInverted((p) => !p)}
          style={{
            background: inverted ? "#ff6b6b" : "#333",
            color: "white",
            border: "none",
            padding: "6px 10px",
            borderRadius: 4,
          }}
        >
          ⟳
        </button>
      </div>

      {/* ---------------- SWIPER ---------------- */}
      <div style={{ flexShrink: 0, padding: 10 }}>
        <Swiper
          spaceBetween={10}
          slidesPerView={1}
          initialSlide={safeIndex}
          onSlideChange={(swiper) => onSelect(swiper.activeIndex)}
          style={{ height: 80 }}
        >
          {coins.map((coin) => (
            <SwiperSlide key={coin.symbol}>
              <div
                style={{
                  background: "#111",
                  borderRadius: 8,
                  padding: 10,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <h3 style={{ margin: 0 }}>{coin.symbol}</h3>

                {coin.daily_distance_pct != null && (
                  <p style={{ margin: 5 }}>
                    {coin.daily_distance_pct}% below daily 5 EMA
                  </p>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* ---------------- CHART ---------------- */}
      <div style={{ flex: 1, padding: 10 }}>
        {selectedCoin && (
          <Chart
            symbol={selectedCoin.symbol}
            timeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
            inverted={inverted}
            onInvertChange={setInverted}
          />
        )}
      </div>
    </div>
  );
}
