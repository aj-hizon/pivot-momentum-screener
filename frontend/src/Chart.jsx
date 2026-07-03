import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import { fetchKlinesWithCache } from "./chartCache";

export default function Chart({
  symbol,
  timeframe = "240",
  onTimeframeChange,
  inverted = false,
  onInvertChange,
}) {
  const ref = useRef();
  const paletteRef = useRef(null);
  const chartContainerRef = useRef(null);
  const inputRef = useRef(null);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const timeframeOptions = [
    { label: "1h", value: "60" },
    { label: "4h", value: "240" },
    { label: "1d", value: "D" },
    { label: "1w", value: "W" },
    { label: "5m", value: "5" },
  ];

  const suggestions = paletteQuery.trim()
    ? timeframeOptions.filter((option) =>
        option.label.toLowerCase().startsWith(paletteQuery.toLowerCase()),
      )
    : timeframeOptions;

  useEffect(() => {
    if (!isPaletteOpen) return;

    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isPaletteOpen]);

  useEffect(() => {
    if (!isPaletteOpen) return;

    const handlePointerDown = (event) => {
      const clickedInsidePalette = paletteRef.current?.contains(event.target);
      if (!clickedInsidePalette) {
        setIsPaletteOpen(false);
        setPaletteQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isPaletteOpen]);

  useEffect(() => {
    if (!isPaletteOpen) return;

    if (selectedSuggestion >= suggestions.length) {
      setSelectedSuggestion(0);
    }
  }, [isPaletteOpen, selectedSuggestion, suggestions.length]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isEditable) {
        if (event.key === "Escape" && isPaletteOpen) {
          event.preventDefault();
          setIsPaletteOpen(false);
          setPaletteQuery("");
        }

        if (event.key === "Enter" && isPaletteOpen) {
          event.preventDefault();
          const inputValue = target?.value ?? paletteQuery;
          const normalizedValue = inputValue.trim().toLowerCase();
          const selected =
            suggestions[selectedSuggestion] ||
            timeframeOptions.find(
              (option) => option.label.toLowerCase() === normalizedValue,
            );
          if (selected) {
            onTimeframeChange?.(selected.value);
          }
          setIsPaletteOpen(false);
          setPaletteQuery("");
        }
        return;
      }

      if (event.key === "Escape" && isPaletteOpen) {
        event.preventDefault();
        setIsPaletteOpen(false);
        setPaletteQuery("");
        return;
      }

      if (event.key === "Backspace" && isPaletteOpen) {
        event.preventDefault();
        setPaletteQuery((value) => value.slice(0, -1));
        setSelectedSuggestion(0);
        return;
      }

      if (isPaletteOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedSuggestion((value) => (value + 1) % suggestions.length);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedSuggestion((value) =>
            value === 0 ? suggestions.length - 1 : value - 1,
          );
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          const selected = suggestions[selectedSuggestion];
          if (selected) {
            onTimeframeChange?.(selected.value);
          }
          setIsPaletteOpen(false);
          setPaletteQuery("");
          return;
        }
      }

      if (!/^[a-z0-9]$/i.test(event.key)) return;

      event.preventDefault();
      setPaletteQuery((value) => `${value}${event.key.toLowerCase()}`);
      setSelectedSuggestion(0);
      setIsPaletteOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPaletteOpen, onTimeframeChange, selectedSuggestion, suggestions]);

  useEffect(() => {
    if (!symbol || !ref.current) return;

    const isMobile = window.innerWidth <= 768;
    const chartHeight = isMobile ? window.innerHeight - 200 : 600;

    // ---------------------------
    // CREATE CHART
    // ---------------------------

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth || 600,

      layout: {
        background: { color: "#000" },
        textColor: "#ccc",
      },

      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },

      rightPriceScale: {
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },

      timeScale: {
        rightOffset: 15, // ✅ space on right side
        barSpacing: 10, // ✅ zoom feel
        fixRightEdge: false,
      },

      crosshair: {
        mode: 0,
      },

      height: chartHeight,
    });

    // ---------------------------
    // CANDLE SERIES
    // ---------------------------

    const candleSeries = chart.addSeries(CandlestickSeries, {
      priceLineVisible: false,

      // ✅ ALWAYS KEEP NORMAL COLORS
      upColor: "#26a69a",
      downColor: "#ef5350",

      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",

      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // ---------------------------
    // EMA SERIES
    // ---------------------------

    const ema21Series = chart.addSeries(LineSeries, {
      color: "#ff6b6b",
      lineWidth: 1,
      priceLineVisible: false,
    });

    const ema100Series = chart.addSeries(LineSeries, {
      color: "#4ecdc4",
      lineWidth: 2,
      priceLineVisible: false,
    });

    // ---------------------------
    // FETCH DATA
    // ---------------------------

    fetchKlinesWithCache(symbol, timeframe, 200).then((data) => {
      if (!data || data.length === 0) return;

      // ---------------------------
      // FORMAT RAW DATA
      // ---------------------------

      const raw = data.map((c) => {
        const t = Number(c[0]);

        return {
          time: t > 1e12 ? Math.floor(t / 1000) : t,
          open: +c[1],
          high: +c[2],
          low: +c[3],
          close: +c[4],
        };
      });

      // ---------------------------
      // TRUE PRICE INVERSION
      // ---------------------------

      let formatted = raw;

      if (inverted) {
        const allPrices = raw.flatMap((c) => [c.open, c.high, c.low, c.close]);

        const maxPrice = Math.max(...allPrices);
        const minPrice = Math.min(...allPrices);

        formatted = raw.map((c) => {
          const invertedOpen = maxPrice + minPrice - c.open;
          const invertedClose = maxPrice + minPrice - c.close;

          const bullish = c.close >= c.open;

          return {
            time: c.time,

            // ✅ preserve original candle color direction
            open: bullish
              ? Math.min(invertedOpen, invertedClose)
              : Math.max(invertedOpen, invertedClose),

            close: bullish
              ? Math.max(invertedOpen, invertedClose)
              : Math.min(invertedOpen, invertedClose),

            // ✅ proper upside-down wick inversion
            high: maxPrice + minPrice - c.low,
            low: maxPrice + minPrice - c.high,
          };
        });
      }

      // ---------------------------
      // SET CANDLE DATA
      // ---------------------------

      candleSeries.setData(formatted);

      // ---------------------------
      // EMA
      // ---------------------------

      const closes = formatted.map((c) => c.close);
      const times = formatted.map((c) => c.time);

      ema21Series.setData(calculateEMA(closes, times, 21));
      ema100Series.setData(calculateEMA(closes, times, 100));

      // ---------------------------
      // TRADINGVIEW FEEL
      // ---------------------------

      chart.timeScale().fitContent();
      chart.timeScale().scrollToPosition(15, false);
    });

    // ---------------------------
    // RESIZE
    // ---------------------------

    const handleResize = () => {
      if (!ref.current) return;

      chart.applyOptions({
        width: ref.current.clientWidth,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, timeframe, inverted]);

  // ---------------------------
  // UI
  // ---------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "#000",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "10px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "10px",
        }}
      >
        {/* SYMBOL */}
        <span
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: "white",
          }}
        >
          {symbol}
        </span>

        {/* TIMEFRAME LABEL */}
        <span style={{ color: "#888" }}>
          Timeframe:{" "}
          {timeframe === "5"
            ? "5m"
            : timeframe === "60"
              ? "1h"
              : timeframe === "240"
                ? "4h"
                : timeframe === "D"
                  ? "1d"
                  : timeframe === "W"
                    ? "1w"
                    : "?"}
        </span>

        {/* BUTTONS */}
        {onTimeframeChange && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => onTimeframeChange("5")}
              style={buttonStyle(timeframe === "5")}
            >
              5M
            </button>

            <button
              onClick={() => onTimeframeChange("60")}
              style={buttonStyle(timeframe === "60")}
            >
              1H
            </button>

            <button
              onClick={() => onTimeframeChange("240")}
              style={buttonStyle(timeframe === "240")}
            >
              4H
            </button>

            <button
              onClick={() => onTimeframeChange("D")}
              style={buttonStyle(timeframe === "D")}
            >
              1D
            </button>

            <button
              onClick={() => onTimeframeChange("W")}
              style={buttonStyle(timeframe === "W")}
            >
              1W
            </button>

            {/* INVERT BUTTON */}
            {onInvertChange && (
              <button
                onClick={() => onInvertChange(!inverted)}
                style={{
                  ...buttonStyle(inverted),
                  fontWeight: "bold",
                }}
                title="Invert chart"
              >
                ⟳
              </button>
            )}
          </div>
        )}
      </div>

      {/* CHART */}
      <div
        ref={(node) => {
          chartContainerRef.current = node;
          ref.current = node;
        }}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {isPaletteOpen && (
          <div
            ref={paletteRef}
            style={{
              position: "absolute",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              width: "min(280px, calc(100% - 32px))",
              background: "#111",
              border: "1px solid #2f2f2f",
              borderRadius: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              padding: 10,
            }}
          >
            <input
              ref={inputRef}
              value={paletteQuery}
              onChange={(event) => {
                const value = event.target.value.toLowerCase();
                setPaletteQuery(value);
                setSelectedSuggestion(0);
              }}
              placeholder="Type 1h, 4h, 1d..."
              style={{
                width: "100%",
                background: "#1a1a1a",
                color: "white",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "8px 10px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {suggestions.length > 0 && (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {suggestions.map((option, index) => (
                  <button
                    key={option.label}
                    onClick={() => {
                      onTimeframeChange?.(option.value);
                      setIsPaletteOpen(false);
                      setPaletteQuery("");
                    }}
                    style={{
                      textAlign: "left",
                      background: index === selectedSuggestion ? "#26a69a" : "#222",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------
// BUTTON STYLE
// ---------------------------

function buttonStyle(active) {
  return {
    background: active ? "#26a69a" : "#333",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 4,
    cursor: "pointer",
  };
}

// ---------------------------
// EMA FUNCTION
// ---------------------------

function calculateEMA(closes, times, period) {
  if (closes.length < period) return [];

  const k = 2 / (period + 1);

  const ema = new Array(closes.length).fill(null);

  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }

  ema[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }

  return ema.reduce((acc, val, i) => {
    if (val !== null && times[i] !== undefined) {
      acc.push({
        time: times[i],
        value: val,
      });
    }

    return acc;
  }, []);
}
