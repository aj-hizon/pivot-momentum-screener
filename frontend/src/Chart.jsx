import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!symbol || !ref.current) return;

    const isMobile = window.innerWidth <= 768;
    const chartHeight = isMobile ? window.innerHeight - 200 : 600;

    // ---------------------------
    // CREATE CHART
    // ---------------------------

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,

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
                  : "1w"}
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
        ref={ref}
        style={{
          flex: 1,
          minHeight: 0,
        }}
      />
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
