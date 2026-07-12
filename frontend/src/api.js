const BASE_URL = "/api";

export async function getScreener(forceRefresh = false) {
  const res = await fetch(`${BASE_URL}/screener?force_refresh=${forceRefresh}`);
  return res.json();
}

export async function getKlines(symbol, interval = "5", limit = 200) {
  const res = await fetch(
    `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );

  return res.json();
}
