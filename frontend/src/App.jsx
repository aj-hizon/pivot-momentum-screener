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
  const [timeframe, setTimeframe] = useState("5");
  const [inverted, setInverted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selected = filteredCoins?.length > 0 ? filteredCoins[index] : null;
  const isMobile = useIsMobile();

  // load screener
  useEffect(() => {
    setLoading(true);
    setError(null);

    getScreener()
      .then((data) => {
        if (Array.isArray(data)) {
          setAllCoins(data);
        } else {
          setAllCoins([]);
          setError('Unexpected screener response');
        }
      })
      .catch((err) => {
        setAllCoins([]);
        setError(err.message || 'Failed to load screener');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // apply filter
  useEffect(() => {
    let filtered = allCoins;
    if (filter === "above") {
      filtered = allCoins.filter(coin => coin.trend === "above");
    } else if (filter === "below") {
      filtered = allCoins.filter(coin => coin.trend === "below");
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

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          background: '#000',
        }}
      >
        Loading screener...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          background: '#000',
          padding: 20,
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 18 }}>Screener error</p>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

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
