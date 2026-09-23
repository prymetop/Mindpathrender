import type { Env, TelegramUpdate } from "./types";
import { requireEnv } from "./core/config";
import { handleUpdate } from "./telegram/handlers";
import { setWebhook } from "./telegram/api";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      requireEnv(env);
    } catch (error) {
      console.error(error);
      return new Response("MindPath configuration error.", { status: 500 });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "mindpath",
        version: "2.0.0-foundation"
      });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const expected = env.TELEGRAM_WEBHOOK_SECRET;
      if (expected) {
        const received = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (received !== expected) return new Response("Unauthorized", { status: 401 });
      }

      const update = await request.json() as TelegramUpdate;
      await handleUpdate(update, env);
      return new Response("OK");
    }

    if (request.method === "POST" && url.pathname === "/admin/set-webhook") {
      const key = request.headers.get("X-MindPath-Admin-Key");
      if (!env.TELEGRAM_WEBHOOK_SECRET || key !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const webhookUrl = `${url.origin}/telegram/webhook`;
      await setWebhook(env, webhookUrl);
      return Response.json({ ok: true, webhook: webhookUrl });
    }

    return new Response("MindPath is running.", { status: 200 });
  }
};
