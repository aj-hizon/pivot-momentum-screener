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

  // ALWAYS define hooks before any conditional return
  useEffect(() => {
    if (!coins || coins.length === 0) return;

    const selectedSymbol = coins[selectedIndex]?.symbol;

    const neighbors = [
      coins[selectedIndex - 1],
      coins[selectedIndex + 1],
    ]
      .filter(Boolean)
      .map((coin) => coin.symbol);

    if (selectedSymbol) {
      prefetchKlines(selectedSymbol, timeframe);
    }

    neighbors.forEach((symbol) => {
      prefetchKlines(symbol, timeframe);
    });
  }, [coins, selectedIndex, timeframe]);

  // Safe fallback
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
        Loading coins...
      </div>
    );
  }

  const selectedCoin = coins[selectedIndex];

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
      {/* Controls */}
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
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          style={{
            background: "#1f1f1f",
            color: "white",
            border: "none",
            padding: 5,
            borderRadius: 4,
          }}
        >
          <option value="all">All Coins</option>
          <option value="above">Above 21 EMA</option>
          <option value="below">Below 21 EMA</option>
        </select>

        <div style={{ display: "flex", gap: 5 }}>
          <button
            onClick={() => onTimeframeChange("60")}
            style={{
              background: timeframe === "60" ? "#26a69a" : "#333",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            1H
          </button>

          <button
            onClick={() => onTimeframeChange("240")}
            style={{
              background: timeframe === "240" ? "#26a69a" : "#333",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            4H
          </button>

          <button
            onClick={() => onTimeframeChange("D")}
            style={{
              background: timeframe === "D" ? "#26a69a" : "#333",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            1D
          </button>

          <button
            onClick={() => setInverted(!inverted)}
            style={{
              background: inverted ? "#ff6b6b" : "#333",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            title="Invert chart"
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Coin Info Swiper */}
      <div style={{ flexShrink: 0, padding: 10 }}>
        <Swiper
          spaceBetween={10}
          slidesPerView={1}
          onSlideChange={(swiper) => onSelect(swiper.activeIndex)}
          initialSlide={selectedIndex}
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

                <p style={{ margin: 5 }}>
                  EMA21: {coin.ema21?.toFixed(4)}
                </p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Chart */}
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