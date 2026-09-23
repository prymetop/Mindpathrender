import type { Env } from "../types";

export function requireEnv(env: Env): void {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  if (!env.OWNER_TELEGRAM_ID) throw new Error("Missing OWNER_TELEGRAM_ID");
}

export function monitoredChannelIds(env: Env): Set<string> {
  return new Set(
    (env.MONITORED_CHANNEL_IDS ?? "")
      .split(",")
      .map(v => v.trim())
      .filter(Boolean)
  );
}
