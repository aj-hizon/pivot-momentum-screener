import { getKlines } from "./api";

const cache = new Map();

function getKey(symbol, interval) {
  return `${symbol}_${interval}`;
}

export async function fetchKlinesWithCache(symbol, interval, limit = 200) {
  const key = `${symbol}_${interval}_${limit}`;
  const existing = cache.get(key);

  if (existing) {
    if (existing.status === "done") {
      return existing.data;
    }
    return existing.promise;
  }

  const promise = getKlines(symbol, interval, limit)
    .then((data) => {
      cache.set(key, { status: "done", data: data || [] });
      return data || [];
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { status: "pending", promise });
  return promise;
}

export function prefetchKlines(symbol, interval) {
  if (!symbol) return;
  fetchKlinesWithCache(symbol, interval).catch(() => {});
}

export function getCachedKlines(symbol, interval) {
  const key = getKey(symbol, interval);
  const existing = cache.get(key);
  return existing?.status === "done" ? existing.data : undefined;
}
