import { getStore } from "@netlify/blobs";

export default async (request) => {
  try {
    const store = getStore("btc-dashboard-data");
    const data = await store.get("urpd-lsr.json", { type: "json", consistency: "strong" });
    if (data) return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("lsr-data blob read failed", error);
  }
  const seed = await fetch(new URL("/urpd-lsr.json", request.url), { cache: "no-store" });
  if (!seed.ok) return new Response(JSON.stringify({ error: "Không tìm thấy dữ liệu L/S" }), { status: 404 });
  return new Response(await seed.text(), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
};
