import { refresh } from "./lsr-refresh-core.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return json(await refresh(request));
  } catch (error) {
    console.error("Manual Coinalyze L/S refresh failed", error);
    return json({ ok: false, error: error.message || "Không cập nhật được dữ liệu. Dữ liệu cũ vẫn được giữ." }, 502);
  }
};
