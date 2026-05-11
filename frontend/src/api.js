const BASE_URL = "/api";

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
