import type { ChatTurn, Env } from "../types";

const MAX_HISTORY = 20;

export async function getHistory(env: Env, chatId: number): Promise<ChatTurn[]> {
  const row = await env.DB
    .prepare("SELECT history_json FROM conversations WHERE chat_id = ?")
    .bind(String(chatId))
    .first<{ history_json: string }>();

  if (!row) return [];
  try {
    const parsed = JSON.parse(row.history_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveHistory(
  env: Env,
  chatId: number,
  history: ChatTurn[]
): Promise<void> {
  await env.DB
    .prepare(`
      INSERT INTO conversations (chat_id, history_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        history_json = excluded.history_json,
        updated_at = excluded.updated_at
    `)
    .bind(String(chatId), JSON.stringify(history.slice(-MAX_HISTORY)), Date.now())
    .run();
}

export async function clearHistory(env: Env, chatId: number): Promise<void> {
  await env.DB
    .prepare("DELETE FROM conversations WHERE chat_id = ?")
    .bind(String(chatId))
    .run();
}
