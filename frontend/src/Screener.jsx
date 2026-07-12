import { useEffect, useRef } from "react";

export default function Screener({
  coins,
  selected,
  index,
  setIndex,
  filter,
  onFilterChange,
}) {
  const containerRef = useRef(null);
  const itemRefs = useRef([]);

  // -----------------------------
  // AUTO SCROLL ON INDEX CHANGE
  // -----------------------------
  useEffect(() => {
    const el = itemRefs.current[index];
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [index]);

  return (
    <div
      style={{
        width: 220,
        background: "#0b0b0b",
        color: "white",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div style={{ padding: 10, borderBottom: "1px solid #222" }}>
        <div style={{ fontSize: 12, color: "#aaa" }}>{coins.length} coins</div>

        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          style={{
            width: "100%",
            marginTop: 8,
            background: "#1f1f1f",
            color: "white",
            border: "none",
            padding: 5,
          }}
        >
          <option value="all">All Coins</option>
          <option value="above21ema">Above 21 EMA</option>
        </select>
      </div>

      {/* LIST */}
      <div ref={containerRef} style={{ flex: 1, overflowY: "auto" }}>
        {coins.map((coin, i) => (
          <div
            key={coin.symbol}
            ref={(el) => (itemRefs.current[i] = el)}
            onClick={(event) => {
              event.stopPropagation();
              setIndex(i);
            }}
            style={{
              padding: 10,
              cursor: "pointer",
              borderBottom: "1px solid #222",
              background: i === index ? "#1f1f1f" : "transparent",
            }}
          >
            <div>{coin.symbol}</div>

            <div
              style={{
                fontSize: 10,
                color: coin.trend === "above21ema" ? "#4ade80" : "#f87171",
              }}
            >
              {coin.trend}
            </div>

            {coin.daily_distance_pct != null && (
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                {coin.daily_distance_pct}% below daily 5 EMA
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
