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

  const selected =
    filteredCoins.length > 0
      ? filteredCoins[Math.min(index, filteredCoins.length - 1)]
      : null;

  // -----------------------------------
  // LOAD SCREENER
  // -----------------------------------
  useEffect(() => {
    setLoading(true);
    setError(null);

    getScreener()
      .then((data) => {
        if (Array.isArray(data)) {
          setAllCoins(data);
        } else {
          setAllCoins([]);
          setError("Unexpected screener response");
        }
      })
      .catch((err) => {
        setAllCoins([]);
        setError(err.message || "Failed to load screener");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // -----------------------------------
  // FILTER LOGIC
  // -----------------------------------
  useEffect(() => {
    let filtered = allCoins;

    if (filter === "above21ema") {
      filtered = allCoins.filter((coin) => coin.trend === "above21ema");
    } else if (filter === "below21ema") {
      filtered = allCoins.filter((coin) => coin.trend === "below21ema");
    }

    setFilteredCoins(filtered);
    setIndex(0);
  }, [allCoins, filter]);

  // -----------------------------------
  // KEYBOARD NAVIGATION (FIXED)
  // -----------------------------------
  useEffect(() => {
    const handle = (e) => {
      if (!filteredCoins.length) return;

      // prevent dropdown / browser hijack
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
      }

      if (e.key === "ArrowDown") {
        setIndex((i) => Math.min(i + 1, filteredCoins.length - 1));
      }

      if (e.key === "ArrowUp") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };

    window.addEventListener("keydown", handle, {
      passive: false, // IMPORTANT so preventDefault works
    });

    return () => {
      window.removeEventListener("keydown", handle);
    };
  }, [filteredCoins]);

  // -----------------------------------
  // LOADING
  // -----------------------------------
  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          background: "#000",
        }}
      >
        Loading screener...
      </div>
    );
  }

  // -----------------------------------
  // ERROR
  // -----------------------------------
  if (error) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          background: "#000",
          padding: 20,
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 18 }}>Screener Error</p>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  // -----------------------------------
  // MOBILE
  // -----------------------------------
  if (isMobile) {
    return (
      <MobileSwiper
        coins={filteredCoins}
        selectedIndex={index}
        onSelect={setIndex}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        filter={filter}
        onFilterChange={setFilter}
      />
    );
  }

  // -----------------------------------
  // DESKTOP
  // -----------------------------------
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
      }}
    >
      <Screener
        coins={filteredCoins}
        selected={selected}
        filter={filter}
        onFilterChange={setFilter}
        onSelect={setIndex}
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
