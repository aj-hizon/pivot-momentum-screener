import { useEffect, useState } from "react";
import { getScreener } from "./api";
import Screener from "./Screener";
import Chart from "./Chart";
import MobileSwiper from "./MobileSwiper";
import { useIsMobile } from "./hooks/useIsMobile";

export default function App() {
  const [allCoins, setAllCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);

  const [filter, setFilter] = useState("all");
  const [index, setIndex] = useState(0);

  const [timeframe, setTimeframe] = useState("5");
  const [inverted, setInverted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMobile = useIsMobile();

  const selected = filteredCoins[index] || null;

  // -----------------------------
  // LOAD DATA
  // -----------------------------
  useEffect(() => {
    setLoading(true);
    setError(null);

    getScreener()
      .then((data) => {
        setAllCoins(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message || "Failed"))
      .finally(() => setLoading(false));
  }, []);

  // -----------------------------
  // GLOBAL FILTER LOGIC (FIXED)
  // -----------------------------
  useEffect(() => {
    let filtered = allCoins;

    if (filter === "above21ema") {
      filtered = allCoins.filter((c) => c.trend === "above21ema");
    }

    if (filter === "below21ema") {
      filtered = allCoins.filter((c) => c.trend === "below21ema");
    }

    setFilteredCoins(filtered);
    setIndex(0); // reset index ALWAYS
  }, [allCoins, filter]);

  // -----------------------------
  // KEYBOARD NAV (DESKTOP ONLY)
  // -----------------------------
  useEffect(() => {
    const handle = (e) => {
      if (!filteredCoins.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filteredCoins.length - 1));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
    };

    window.addEventListener("keydown", handle, {
      passive: false,
    });

    return () => window.removeEventListener("keydown", handle);
  }, [filteredCoins]);

  // -----------------------------
  // LOADING
  // -----------------------------
  if (loading) {
    return <div style={styles.center}>Loading screener...</div>;
  }

  // -----------------------------
  // ERROR
  // -----------------------------
  if (error) {
    return <div style={styles.center}>Screener Error: {error}</div>;
  }

  // -----------------------------
  // MOBILE
  // -----------------------------
  if (isMobile) {
    return (
      <MobileSwiper
        coins={filteredCoins} // ✅ ALWAYS filtered
        selectedIndex={index}
        onSelect={setIndex}
        filter={filter}
        onFilterChange={setFilter}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />
    );
  }

  // -----------------------------
  // DESKTOP
  // -----------------------------
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Screener
        coins={filteredCoins}
        selected={selected}
        index={index}
        setIndex={setIndex}
        filter={filter}
        onFilterChange={setFilter}
      />

      {selected && (
        <Chart
          symbol={selected.symbol}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          inverted={inverted}
          onInvertChange={setInverted}
        />
      )}
    </div>
  );
}

const styles = {
  center: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
    background: "#000",
  },
};
