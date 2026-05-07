const BASE_URL = import.meta.env.VITE_API_URL;

export async function getScreener() {
  const res = await fetch(`${BASE_URL}/screener`);
  return res.json();
}

export async function getKlines(symbol, interval = "240") {
  const res = await fetch(
    `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}`
  );
  return res.json();
}