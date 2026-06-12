export default function Screener({ coins, selected, filter, onFilterChange, onSelect }) {
  return (
    <div style={{
      width: 220,
      background: "#0b0b0b",
      color: "white",
      overflowY: "auto",
      height: "100vh",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{ padding: 10, borderBottom: "1px solid #222" }}>
        <div style={{ marginBottom: 8, fontSize: 12, color: "#aaa" }}>
          {coins.length} coins
        </div>
        <select 
          value={filter} 
          onChange={(e) => onFilterChange(e.target.value)}
          style={{ width: "100%", background: "#1f1f1f", color: "white", border: "none", padding: 5 }}
        >
          <option value="all">All Coins</option>
          <option value="above">Above 21 EMA</option>
          <option value="below">Below 21 EMA</option>
        </select>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {coins.length === 0 ? (
          <div style={{ padding: 10, color: "#888" }}>
            No coins match the selected filter.
          </div>
        ) : (
          coins.map((coin, idx) => (
            <div
              key={coin.symbol}
              onClick={() => onSelect(idx)}
              style={{
                padding: 10,
                background: selected?.symbol === coin.symbol ? "#1f1f1f" : "transparent",
                borderBottom: "1px solid #222",
                cursor: "pointer"
              }}
            >
              {coin.symbol}
            </div>
          ))
        )}
      </div>
    </div>
  );
}