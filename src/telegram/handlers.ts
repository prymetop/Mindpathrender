import type { Env, TelegramMessage, TelegramUpdate } from "../types";
import { getAIProvider } from "../ai/router";
import { clearHistory, getHistory, saveHistory } from "../storage/conversations";
import { sendTelegramMessage, sendTyping, getFilePath } from "./api";
import { handleChannelPost } from "../monitoring/channel-monitor";
import { isOwner } from "../security/authorization";

function firstName(message?: TelegramMessage): string {
  return message?.from?.first_name?.trim() || "there";
}

function isGroup(message: TelegramMessage): boolean {
  return message.chat.type === "group" || message.chat.type === "supergroup";
}

function addressed(message: TelegramMessage): boolean {
  const text = message.text ?? message.caption ?? "";
  return text.includes("@MindPath");
}

export async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  if (update.channel_post) return handleChannelPost(update.channel_post, env);
  if (update.edited_channel_post) return handleChannelPost(update.edited_channel_post, env);

  if (!isOwner(update, env)) return;

  if (update.callback_query) {
    if (update.callback_query.data === "new_chat") {
      const chatId = update.callback_query.message?.chat.id;
      if (chatId !== undefined) {
        await clearHistory(env, chatId);
        await sendTelegramMessage(
          env,
          chatId,
          `Fresh start, ${firstName(update.callback_query.message)}. What's on your mind?`
        );
      }
    }
    return;
  }

  const message = update.message;
  if (!message) return;
  const text = message.text?.trim() ?? "";

  if (text === "/start") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      `Hey ${firstName(message)} 👋 I'm MindPath.\n\nI'm your private AI assistant. Ask me something, send an image, or use /reset for a fresh conversation.`
    );
    return;
  }

  if (text === "/reset") {
    await clearHistory(env, message.chat.id);
    await sendTelegramMessage(env, message.chat.id, "✓ Conversation memory cleared.");
    return;
  }

  if (text === "/status") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "✓ MindPath is online.\n\nCore: operational\nAI: provider configured\nStorage: persistent conversation database"
    );
    return;
  }

  if (text === "/help") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      [
        "MindPath commands:",
        "",
        "/start — start MindPath",
        "/reset — clear this conversation",
        "/status — check core status",
        "/help — show commands",
        "",
        "Send normal text or an image to talk to MindPath."
      ].join("\n")
    );
    return;
  }

  if (isGroup(message) && !addressed(message)) return;

  const history = await getHistory(env, message.chat.id);
  const provider = getAIProvider(env);
  await sendTyping(env, message.chat.id);

  let reply: string;

  try {
    if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1];
      const filePath = await getFilePath(env, largest.file_id);
      const imageResponse = await fetch(
        `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`
      );
      if (!imageResponse.ok) throw new Error("Could not download Telegram image.");

      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }

      reply = await provider.generate({
        history,
        firstName: firstName(message),
        userText: message.caption?.trim() || "Analyze this image carefully.",
        image: { mimeType: "image/jpeg", dataBase64: btoa(binary) }
      });
    } else {
      if (!text) return;
      reply = await provider.generate({
        history,
        firstName: firstName(message),
        userText: text
      });
    }
  } catch (error) {
    console.error("MindPath AI error", error);
    await sendTelegramMessage(
      env,
      message.chat.id,
      "⚠️ I couldn't complete that request right now. The failure was logged and the conversation was not marked as completed."
    );
    return;
  }

  const userParts = message.photo?.length
    ? [{ text: message.caption?.trim() || "[image]" }]
    : [{ text }];

  await saveHistory(env, message.chat.id, [
    ...history,
    { role: "user", parts: userParts },
    { role: "model", parts: [{ text: reply }] }
  ]);

  await sendTelegramMessage(env, message.chat.id, reply);
}
