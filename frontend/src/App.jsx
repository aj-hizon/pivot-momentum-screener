import { useEffect, useState } from "react";
import { getScreener } from "./api";
import Screener from "./Screener";
import Chart from "./Chart";
import MobileSwiper from "./MobileSwiper";
import { useIsMobile } from "./hooks/useIsMobile";

export default function App() {
  const [allCoins, setAllCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);
  const [filter, setFilter] = useState("all"); // "all", "above", "below"
  const [index, setIndex] = useState(0);
  const [timeframe, setTimeframe] = useState("240");
  const [inverted, setInverted] = useState(false);

  const selected = filteredCoins?.length > 0 ? filteredCoins[index] : null;
  const isMobile = useIsMobile();

  // load screener
  useEffect(() => {
    getScreener()
      .then((data) => {
        if (Array.isArray(data)) {
          setAllCoins(data);
        } else {
          setAllCoins([]);
        }
      })
      .catch(() => {
        setAllCoins([]);
      });
  }, []);

  // apply filter
  useEffect(() => {
    let filtered = allCoins;
    if (filter === "above") {
      filtered = allCoins.filter(coin => coin.close > coin.ema21);
    } else if (filter === "below") {
      filtered = allCoins.filter(coin => coin.close < coin.ema21);
    }
    setFilteredCoins(filtered);
    setIndex(0); // reset to first
  }, [allCoins, filter]);

  // keyboard navigation (TradingView style)
  useEffect(() => {
    const handle = (e) => {
      if (!filteredCoins.length) return;

      if (e.key === "ArrowDown") {
        setIndex((i) => Math.min(i + 1, filteredCoins.length - 1));
      }

      if (e.key === "ArrowUp") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [filteredCoins]);

  return isMobile ? (
    <MobileSwiper 
      coins={filteredCoins} 
      selectedIndex={index} 
      onSelect={setIndex}
      timeframe={timeframe}
      onTimeframeChange={setTimeframe}
      filter={filter}
      onFilterChange={setFilter}
    />
  ) : (
    <div style={{ display: "flex", height: "100vh" }}>
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
