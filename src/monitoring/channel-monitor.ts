import type { Env, TelegramMessage } from "../types";
import { detectExternalUrls } from "./url-detector";
import { monitoredChannelIds } from "../core/config";
import { sendTelegramMessage } from "../telegram/api";

export async function handleChannelPost(
  message: TelegramMessage,
  env: Env
): Promise<void> {
  if (!monitoredChannelIds(env).has(String(message.chat.id))) return;

  const content = [message.text, message.caption].filter(Boolean).join("\n");
  const urls = detectExternalUrls(content);
  if (!urls.length) return;

  const eventKey = `channel:${message.chat.id}:${message.message_id}`;
  const existing = await env.DB
    .prepare("SELECT event_key FROM processed_events WHERE event_key = ?")
    .bind(eventKey)
    .first();

  if (existing) return;

  await env.DB
    .prepare("INSERT INTO processed_events (event_key, processed_at) VALUES (?, ?)")
    .bind(eventKey, Date.now())
    .run();

  const channelName =
    message.chat.title ??
    (message.chat.username ? `@${message.chat.username}` : String(message.chat.id));

  await sendTelegramMessage(
    env,
    env.OWNER_TELEGRAM_ID,
    [
      "🔗 MindPath channel alert",
      "",
      `Channel: ${channelName}`,
      `Message: #${message.message_id}`,
      "",
      content ? `Post:\n${content.slice(0, 3000)}` : "Post: [no text/caption]",
      "",
      "External URL(s):",
      ...urls.map(url => `• ${url}`)
    ].join("\n")
  );
}
