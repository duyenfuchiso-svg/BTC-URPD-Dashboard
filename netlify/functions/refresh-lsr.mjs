import { refresh } from "./lsr-refresh-core.mjs";

export default async (request) => {
  try {
    const { next_run } = await request.json().catch(() => ({}));
    const result = await refresh(request);
    console.log("Scheduled Coinalyze L/S refresh complete", { next_run, ...result });
  } catch (error) {
    // Do not overwrite the previous blob when any source fails.
    console.error("Scheduled Coinalyze L/S refresh failed; previous snapshot retained:", error);
  }
};

export const config = { schedule: "0 0 * * *" };
