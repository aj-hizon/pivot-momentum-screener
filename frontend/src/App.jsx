import { useEffect, useRef, useState } from "react";
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

  const selectedSymbolRef = useRef(null);
  const previousFilterRef = useRef(filter);

  const [timeframe, setTimeframe] = useState("5");
  const [inverted, setInverted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMobile = useIsMobile();

  const selected = filteredCoins[index] || null;

  const selectCoin = (nextIndex, reason) => {
    const nextCoin = filteredCoins[nextIndex];
    if (!nextCoin) return;

    const previousIndex = index;
    const previousSymbol =
      selectedSymbolRef.current || filteredCoins[previousIndex]?.symbol || null;
    const nextSymbol = nextCoin.symbol;

    if (previousIndex === nextIndex && previousSymbol === nextSymbol) {
      return;
    }

    console.log("[Screener selection]", {
      reason,
      previousIndex,
      newIndex: nextIndex,
      previousSymbol,
      newSymbol: nextSymbol,
    });

    selectedSymbolRef.current = nextSymbol;
    setIndex(nextIndex);
  };

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
    const filterChanged = previousFilterRef.current !== filter;
    previousFilterRef.current = filter;

    let filtered = allCoins;

    if (filter === "above21ema") {
      filtered = allCoins.filter((c) => c.trend === "above21ema");
    }

    if (filter === "1d-above21ema") {
      filtered = allCoins.filter((c) => c.trend === "1d-above21ema");
    }

    setFilteredCoins(filtered);

    if (filterChanged) {
      const nextIndex = filtered.findIndex(
        (coin) => coin.symbol === selectedSymbolRef.current,
      );
      const fallbackIndex = nextIndex >= 0 ? nextIndex : 0;
      selectedSymbolRef.current = filtered[fallbackIndex]?.symbol || null;
      setIndex(fallbackIndex);
      return;
    }

    const previousSymbol = selectedSymbolRef.current;
    if (previousSymbol) {
      const nextIndex = filtered.findIndex((coin) => coin.symbol === previousSymbol);
      if (nextIndex >= 0) {
        selectedSymbolRef.current = previousSymbol;
        setIndex(nextIndex);
        return;
      }
    }

    const fallbackIndex = 0;
    selectedSymbolRef.current = filtered[fallbackIndex]?.symbol || null;
    setIndex(fallbackIndex);
  }, [allCoins, filter]);

  // -----------------------------
  // KEYBOARD NAV (DESKTOP ONLY)
  // -----------------------------
  useEffect(() => {
    const handle = (e) => {
      if (!filteredCoins.length || e.repeat) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(index + 1, filteredCoins.length - 1);
        selectCoin(nextIndex, "keyboard");
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIndex = Math.max(index - 1, 0);
        selectCoin(nextIndex, "keyboard");
      }
    };

    window.addEventListener("keydown", handle, {
      passive: false,
    });

    return () => window.removeEventListener("keydown", handle);
  }, [filteredCoins, index]);

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
        onSelect={(nextIndex) => selectCoin(nextIndex, "swipe")}
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
        setIndex={(nextIndex) => selectCoin(nextIndex, "mouse")}
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
