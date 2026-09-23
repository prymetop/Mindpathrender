import type { Env } from "../types";

async function request<T>(
  env: Env,
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json() as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${data.description ?? ""}`);
  }

  return data.result as T;
}

export async function sendTelegramMessage(
  env: Env,
  chatId: string | number,
  text: string
): Promise<void> {
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [text];
  for (const chunk of chunks) {
    await request(env, "sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true
    });
  }
}

export async function sendTyping(env: Env, chatId: string | number): Promise<void> {
  await request(env, "sendChatAction", { chat_id: chatId, action: "typing" });
}

export async function getFilePath(env: Env, fileId: string): Promise<string> {
  const result = await request<{ file_path?: string }>(env, "getFile", { file_id: fileId });
  if (!result.file_path) throw new Error("Telegram file path unavailable.");
  return result.file_path;
}

export async function setWebhook(env: Env, webhookUrl: string): Promise<void> {
  await request(env, "setWebhook", {
    url: webhookUrl,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "callback_query", "channel_post", "edited_channel_post"]
  });
}
