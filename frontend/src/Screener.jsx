import { useEffect, useRef } from "react";

export default function Screener({
  coins,
  selected,
  filter,
  onFilterChange,
  onSelect,
}) {
  const itemRefs = useRef({});

  // -----------------------------------
  // AUTO SCROLL TO SELECTED ITEM
  // -----------------------------------
  useEffect(() => {
    if (!selected?.symbol) return;

    const el = itemRefs.current[selected.symbol];

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selected]);

  return (
    <div
      style={{
        width: 220,
        background: "#0b0b0b",
        color: "white",
        overflowY: "auto",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: 10,
          borderBottom: "1px solid #222",
        }}
      >
        <div
          style={{
            marginBottom: 8,
            fontSize: 12,
            color: "#aaa",
          }}
        >
          {coins.length} coins
        </div>

        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          style={{
            width: "100%",
            background: "#1f1f1f",
            color: "white",
            border: "none",
            padding: 5,
          }}
        >
          <option value="all">All Coins</option>
          <option value="above21ema">Above 21 EMA</option>
          <option value="below21ema">Below 21 EMA</option>
        </select>
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {coins.length === 0 ? (
          <div
            style={{
              padding: 10,
              color: "#888",
            }}
          >
            No coins match the selected filter.
          </div>
        ) : (
          coins.map((coin, idx) => (
            <div
              key={coin.symbol}
              ref={(el) => {
                itemRefs.current[coin.symbol] = el;
              }}
              onClick={() => onSelect(idx)}
              style={{
                padding: 10,
                cursor: "pointer",
                borderBottom: "1px solid #222",
                background:
                  selected?.symbol === coin.symbol ? "#1f1f1f" : "transparent",
              }}
            >
              <div style={{ fontSize: 13 }}>{coin.symbol}</div>

              <div
                style={{
                  fontSize: 10,
                  color: coin.trend === "above21ema" ? "#4ade80" : "#f87171",
                }}
              >
                {coin.trend}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
