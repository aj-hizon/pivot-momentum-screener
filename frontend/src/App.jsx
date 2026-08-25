import { useEffect, useMemo, useRef, useState } from "react";
import { getScreener } from "./api";
import Screener from "./Screener";
import Chart from "./Chart";
import MobileSwiper from "./MobileSwiper";
import { useIsMobile } from "./hooks/useIsMobile";

export default function App() {
  const [allCoins, setAllCoins] = useState([]);

  const [filter, setFilter] = useState("all");
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const lastSelectedIndexRef = useRef(0);

  const [timeframe, setTimeframe] = useState("5");
  const [inverted, setInverted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const isMobile = useIsMobile();

  const filteredCoins = useMemo(() => {
    if (filter === "all") {
      return allCoins;
    }

    return allCoins.filter((coin) => {
      if (Array.isArray(coin.filters)) {
        return coin.filters.includes(filter);
      }

      return coin.trend === filter;
    });
  }, [allCoins, filter]);

  const selectedIndex = useMemo(() => {
    if (!filteredCoins.length) {
      return 0;
    }

    if (selectedSymbol) {
      const index = filteredCoins.findIndex((coin) => coin.symbol === selectedSymbol);
      if (index >= 0) {
        lastSelectedIndexRef.current = index;
        return index;
      }
    }

    const fallbackIndex = Math.min(lastSelectedIndexRef.current, filteredCoins.length - 1);
    lastSelectedIndexRef.current = fallbackIndex;
    return fallbackIndex;
  }, [filteredCoins, selectedSymbol]);

  const selected = filteredCoins[selectedIndex] || null;

  const selectCoin = (nextIndex) => {
    const nextCoin = filteredCoins[nextIndex];
    if (!nextCoin) return;

    lastSelectedIndexRef.current = nextIndex;
    setSelectedSymbol(nextCoin.symbol);
  };

  const loadScreener = async (showLoading = false, forceRefresh = false) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const data = await getScreener(forceRefresh);
      setAllCoins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = () => {
    loadScreener(false, true);
  };

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);
    setInverted(nextFilter === "below21ema");
  };

  // -----------------------------
  // LOAD DATA
  // -----------------------------
  useEffect(() => {
    loadScreener(true, false);
  }, []);

  // -----------------------------
  // SELECTION RECONCILIATION
  // -----------------------------
  useEffect(() => {
    if (!filteredCoins.length) {
      setSelectedSymbol(null);
      lastSelectedIndexRef.current = 0;
      return;
    }

    if (selectedSymbol && filteredCoins.some((coin) => coin.symbol === selectedSymbol)) {
      return;
    }

    const fallbackIndex = Math.min(lastSelectedIndexRef.current, filteredCoins.length - 1);
    const fallbackSymbol = filteredCoins[fallbackIndex]?.symbol || null;
    lastSelectedIndexRef.current = fallbackIndex;
    setSelectedSymbol(fallbackSymbol);
  }, [filteredCoins, selectedSymbol]);

  // -----------------------------
  // KEYBOARD NAV (DESKTOP ONLY)
  // -----------------------------
  useEffect(() => {
    const handle = (e) => {
      if (!filteredCoins.length || e.repeat) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, filteredCoins.length - 1);
        selectCoin(nextIndex);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIndex = Math.max(selectedIndex - 1, 0);
        selectCoin(nextIndex);
      }
    };

    window.addEventListener("keydown", handle, {
      passive: false,
    });

    return () => window.removeEventListener("keydown", handle);
  }, [filteredCoins, selectedIndex]);

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
        selectedIndex={selectedIndex}
        onSelect={(nextIndex) => selectCoin(nextIndex)}
        filter={filter}
        onFilterChange={handleFilterChange}
        inverted={inverted}
        onInvertChange={setInverted}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onRefresh={handleRefresh}
        refreshing={refreshing}
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
        index={selectedIndex}
        setIndex={(nextIndex) => selectCoin(nextIndex)}
        filter={filter}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        refreshing={refreshing}
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
