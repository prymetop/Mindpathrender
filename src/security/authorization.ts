import type { Env, TelegramUpdate } from "../types";

export function isOwner(update: TelegramUpdate, env: Env): boolean {
  const ownerId = String(env.OWNER_TELEGRAM_ID);
  const ids = [
    update.message?.from?.id,
    update.edited_message?.from?.id,
    update.callback_query?.from?.id
  ].filter((id): id is number => typeof id === "number");

  return ids.some(id => String(id) === ownerId);
}
