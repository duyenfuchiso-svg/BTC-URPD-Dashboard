import { getStore } from "@netlify/blobs";

const API = "https://api.coinalyze.net/v1";
const STORE = "btc-dashboard-data";
const KEY = "urpd-lsr.json";
const EXCHANGE_PRIORITY = [
  "Binance", "Bybit", "OKX", "Bitget", "Gate.io", "KuCoin", "BingX", "Hyperliquid", "MEXC", "Deribit"
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

async function api(path, apiKey) {
  const response = await fetch(`${API}${path}`, {
    headers: { api_key: apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Coinalyze ${response.status}: ${detail.slice(0, 180)}`);
  }
  return response.json();
}

function chooseMarkets(markets) {
  const eligible = markets.filter(m =>
    m.base_asset === "BTC" && m.quote_asset === "USDT" &&
    m.is_perpetual === true && m.has_long_short_ratio_data === true
  );
  const selected = [];
  for (const name of EXCHANGE_PRIORITY) {
    const match = eligible.find(m => String(m.exchange).toLowerCase() === name.toLowerCase());
    if (match && !selected.some(x => x.symbol === match.symbol)) selected.push(match);
  }
  // Add other supported BTC/USDT perpetual venues if a preferred venue is absent.
  for (const market of eligible) {
    if (selected.length >= 8) break;
    if (!selected.some(x => x.symbol === market.symbol)) selected.push(market);
  }
  return selected.slice(0, 8);
}

function aggregateHistory(results, candleTimes, intervalSeconds) {
  const byTime = new Map();
  for (const result of results) {
    for (const point of (result.history || [])) {
      const ratio = Number(point.r);
      if (!Number.isFinite(ratio) || ratio <= 0) continue;
      const pct = 100 * ratio / (1 + ratio);
      const key = Math.round(Number(point.t) / intervalSeconds) * intervalSeconds;
      if (!byTime.has(key)) byTime.set(key, []);
      byTime.get(key).push(pct);
    }
  }
  return candleTimes.map(t => {
    const vals = byTime.get(Math.round(t / intervalSeconds) * intervalSeconds) || [];
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100;
  });
}

export async function refresh(request) {
  const apiKey = process.env.COINALYZE_API_KEY;
  if (!apiKey) throw new Error("Thiếu biến COINALYZE_API_KEY trong Netlify.");
  const store = getStore(STORE);
  let previous = await store.get(KEY, { type: "json" }).catch(() => null);
  if (!previous) {
    const origin = new URL(request.url).origin;
    const seed = await fetch(`${origin}/urpd-lsr.json`, { cache: "no-store" });
    if (seed.ok) previous = await seed.json();
  }
  const markets = await api("/future-markets", apiKey);
  const selected = chooseMarkets(markets);
  if (!selected.length) throw new Error("Coinalyze không trả về hợp đồng BTC/USDT có dữ liệu Long/Short.");
  const symbols = selected.map(m => m.symbol).join(",");
  const now = Math.floor(Date.now() / 1000);
  const fromDaily = now - 185 * 86400;
  const from4h = now - 45 * 86400;
  const [daily, fourHour] = await Promise.all([
    api(`/long-short-ratio-history?symbols=${encodeURIComponent(symbols)}&interval=daily&from=${fromDaily}&to=${now}`, apiKey),
    api(`/long-short-ratio-history?symbols=${encodeURIComponent(symbols)}&interval=4hour&from=${from4h}&to=${now}`, apiKey)
  ]);
  const current = previous && previous.d1 && previous.h4 ? previous : null;
  if (!current) throw new Error("Không tìm thấy dữ liệu L/S gốc để giữ biểu đồ giá. Hãy triển khai lại bộ dữ liệu website đầy đủ.");
  const d1 = aggregateHistory(daily, current.d1.t, 86400);
  const h4 = aggregateHistory(fourHour, current.h4.t, 14400);
  const validD = d1.filter(Number.isFinite).length;
  const validH = h4.filter(Number.isFinite).length;
  if (validD < 30 || validH < 12) throw new Error(`Dữ liệu Coinalyze chưa đủ: daily ${validD}, 4h ${validH}. Giữ nguyên dữ liệu cũ.`);
  const updated = structuredClone(current);
  updated.d1.okx = d1;
  updated.d1.gate = Array(d1.length).fill(null);
  updated.h4.okx = h4;
  updated.h4.gate = Array(h4.length).fill(null);
  updated.built = new Date().toISOString();
  updated.src = `Coinalyze: trung bình ${selected.length} hợp đồng BTC/USDT vĩnh cửu có dữ liệu Long/Short (${selected.map(m => m.exchange).join(", ")}); tỷ lệ Long suy ra từ L/S ratio`;
  updated.coinalyze = { exchanges: selected.map(m => m.exchange), symbols: selected.map(m => m.symbol), dailyPoints: validD, fourHourPoints: validH };
  await store.set(KEY, JSON.stringify(updated), { metadata: { built: updated.built, source: "Coinalyze" } });
  return { ok: true, built: updated.built, exchanges: selected.map(m => m.exchange), dailyPoints: validD, fourHourPoints: validH };
}

