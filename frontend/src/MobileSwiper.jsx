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

  // -----------------------------
  // TIMEFRAME LABELS (FIX)
  // -----------------------------
  const TIMEFRAME_LABELS = {
    5: "5M",
    60: "1H",
    240: "4H",
    D: "1D",
    W: "1W",
  };

  // -----------------------------
  // SAFE INDEX HANDLING
  // -----------------------------
  const safeIndex =
    coins && coins.length > 0 ? Math.min(selectedIndex, coins.length - 1) : 0;

  const selectedCoin = coins?.[safeIndex];

  // -----------------------------
  // PREFETCH (SAFE)
  // -----------------------------
  useEffect(() => {
    if (!coins || coins.length === 0) return;

    const current = coins[safeIndex];

    if (!current) return;

    const neighbors = [coins[safeIndex - 1], coins[safeIndex + 1]]
      .filter(Boolean)
      .map((c) => c.symbol);

    prefetchKlines(current.symbol, timeframe);

    neighbors.forEach((symbol) => {
      prefetchKlines(symbol, timeframe);
    });
  }, [coins, safeIndex, timeframe]);

  // -----------------------------
  // EMPTY STATE
  // -----------------------------
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
      {/* ----------------------------- */}
      {/* CONTROLS */}
      {/* ----------------------------- */}
      <div
        style={{
          background: "#111",
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {/* FILTER */}
        <select
          value={filter}
          onChange={(e) => {
            onFilterChange(e.target.value);
            onSelect(0); // reset index when filter changes
          }}
          style={{
            background: "#1f1f1f",
            color: "white",
            border: "none",
            padding: 5,
            borderRadius: 4,
          }}
        >
          <option value="all">All Coins</option>
          <option value="above21ema">Above 21 EMA</option>
          <option value="below21ema">Below 21 EMA</option>
        </select>

        {/* TIMEFRAMES */}
        <div style={{ display: "flex", gap: 5 }}>
          {Object.keys(TIMEFRAME_LABELS).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              style={{
                background: timeframe === tf ? "#26a69a" : "#333",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}

          {/* INVERT */}
          <button
            onClick={() => setInverted((prev) => !prev)}
            style={{
              background: inverted ? "#ff6b6b" : "#333",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* ----------------------------- */}
      {/* SWIPER */}
      {/* ----------------------------- */}
      <div style={{ flexShrink: 0, padding: 10 }}>
        <Swiper
          spaceBetween={10}
          slidesPerView={1}
          initialSlide={safeIndex}
          onSlideChange={(swiper) => {
            onSelect(swiper.activeIndex);
          }}
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

                <p style={{ margin: 5 }}>
                  Price: {Number(coin.close).toFixed(4)}
                </p>

                <p style={{ margin: 5 }}>EMA21: {coin.ema21?.toFixed(4)}</p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* ----------------------------- */}
      {/* CHART */}
      {/* ----------------------------- */}
      <div style={{ flex: 1, padding: 10 }}>
        {selectedCoin && (
          <Chart
            symbol={selectedCoin.symbol}
            timeframe={timeframe}
            inverted={inverted}
            onInvertChange={setInverted}
          />
        )}
      </div>
    </div>
  );
}
