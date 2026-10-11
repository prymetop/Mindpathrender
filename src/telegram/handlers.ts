import type { Env, TelegramMessage, TelegramUpdate } from "../types";
import { getAIProvider } from "../ai/router";
import {
  clearHistory,
  getHistory,
  saveHistory
} from "../storage/conversations";
import {
  clearImageContext,
  getRecentImageReferences,
  saveImageReference
} from "../storage/image-context";
import {
  sendTelegramMessage,
  sendTyping,
  getFilePath
} from "./api";
import { handleChannelPost } from "../monitoring/channel-monitor";
import { isOwner } from "../security/authorization";

const MAX_IMAGES_PER_REQUEST = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function firstName(message?: TelegramMessage): string {
  return message?.from?.first_name?.trim() || "there";
}

function isGroup(message: TelegramMessage): boolean {
  return (
    message.chat.type === "group" ||
    message.chat.type === "supergroup"
  );
}

function addressed(message: TelegramMessage): boolean {
  const text = message.text ?? message.caption ?? "";
  return text.includes("@MindPath");
}

function isSupportedImageDocument(
  message: TelegramMessage
): boolean {
  const mimeType = message.document?.mime_type?.toLowerCase();

  return Boolean(
    message.document &&
    mimeType &&
    SUPPORTED_IMAGE_TYPES.has(mimeType)
  );
}

function imageDocumentMimeType(
  message: TelegramMessage
): string {
  return message.document?.mime_type?.toLowerCase() || "image/jpeg";
}

async function downloadTelegramImage(
  env: Env,
  fileId: string,
  mimeType: string
): Promise<{ mimeType: string; dataBase64: string }> {
  const filePath = await getFilePath(env, fileId);

  const response = await fetch(
    `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`
  );

  if (!response.ok) {
    throw new Error("Could not download Telegram image.");
  }

  const contentLength = Number(
    response.headers.get("content-length") || "0"
  );

  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 3 MB processing limit.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length === 0) {
    throw new Error("The downloaded image is empty.");
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 3 MB processing limit.");
  }

  let binary = "";

  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + 8192)
    );
  }

  return {
    mimeType,
    dataBase64: btoa(binary)
  };
}

export async function handleUpdate(
  update: TelegramUpdate,
  env: Env
): Promise<void> {
  if (update.channel_post) {
    return handleChannelPost(update.channel_post, env);
  }

  if (update.edited_channel_post) {
    return handleChannelPost(update.edited_channel_post, env);
  }

  if (!isOwner(update, env)) return;

  if (update.callback_query) {
    if (update.callback_query.data === "new_chat") {
      const chatId = update.callback_query.message?.chat.id;

      if (chatId !== undefined) {
        await clearHistory(env, chatId);
        await clearImageContext(env, chatId);

        await sendTelegramMessage(
          env,
          chatId,
          `Fresh start, ${firstName(
            update.callback_query.message
          )}. What's on your mind?`
        );
      }
    }

    return;
  }

  const message = update.message;

  if (!message) return;

  const text = message.text?.trim() ?? "";
  const caption = message.caption?.trim() ?? "";

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
    await clearImageContext(env, message.chat.id);

    await sendTelegramMessage(
      env,
      message.chat.id,
      "✓ Conversation memory and temporary image context cleared."
    );

    return;
  }

  if (text === "/status") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "✓ MindPath is online.\n\nCore: operational\nAI: provider configured\nStorage: persistent conversation database\nImage context: temporary, 30-minute retention"
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
        "/reset — clear conversation and image context",
        "/status — check core status",
        "/help — show commands",
        "",
        "Send text, photos, or supported image documents.",
        "Ask follow-up questions about recent images within 30 minutes."
      ].join("\n")
    );

    return;
  }

  const hasPhoto = Boolean(message.photo?.length);
  const hasDocument = Boolean(message.document);

  const supportedDocument = isSupportedImageDocument(message);

  if (hasDocument && !supportedDocument) {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "I can process images sent as photos or supported image documents. Other file types aren't supported."
    );

    return;
  }

  if (isGroup(message) && !addressed(message)) return;

  if (!text && !caption && !hasPhoto && !supportedDocument) {
    return;
  }

  const incomingImage = hasPhoto || supportedDocument;

  const currentFileId = hasPhoto
    ? message.photo![message.photo!.length - 1].file_id
    : supportedDocument
      ? message.document!.file_id
      : undefined;

  const currentMimeType = hasPhoto
    ? "image/jpeg"
    : supportedDocument
      ? imageDocumentMimeType(message)
      : undefined;

  const history = await getHistory(env, message.chat.id);
  const provider = getAIProvider(env);

  await sendTyping(env, message.chat.id);

  let reply: string;

  try {
    // Save the incoming image reference before retrieving recent context.
    if (currentFileId && currentMimeType) {
      await saveImageReference(
        env,
        message.chat.id,
        currentFileId,
        currentMimeType,
        caption
      );
    }

    // Retrieve recent image references. Expired references are removed
    // by the storage module.
    const recentReferences = await getRecentImageReferences(
      env,
      message.chat.id
    );

    // Send at most three recent images to Gemini per request.
    const referencesToProcess = recentReferences.slice(
      -MAX_IMAGES_PER_REQUEST
    );

    const images: Array<{
      mimeType: string;
      dataBase64: string;
    }> = [];

    for (const reference of referencesToProcess) {
      try {
        const downloaded = await downloadTelegramImage(
          env,
          reference.file_id,
          reference.mime_type
        );

        images.push(downloaded);
      } catch (error) {
        console.error(
          "MindPath image retrieval error",
          error
        );

        // If the current image failed, report the failure.
        // Older unavailable images can be skipped.
        if (reference.file_id === currentFileId) {
          throw error;
        }
      }
    }

    let userText: string;

    if (incomingImage) {
      userText = caption || "Analyze this image carefully.";
    } else {
      userText = text;
    }

    // If recent images exist, attach them to the request so the user
    // can ask follow-up questions without uploading them again.
    reply = await provider.generate({
      history,
      firstName: firstName(message),
      userText,
      images
    });
  } catch (error) {
    console.error("MindPath AI error", error);

    await sendTelegramMessage(
      env,
      message.chat.id,
      "⚠️ I couldn't complete that request right now. Please try again. The failure was logged."
    );

    return;
  }

  const userParts = incomingImage
    ? [{ text: caption || "[image]" }]
    : [{ text }];

  await saveHistory(env, message.chat.id, [
    ...history,
    { role: "user", parts: userParts },
    { role: "model", parts: [{ text: reply }] }
  ]);

  await sendTelegramMessage(
    env,
    message.chat.id,
    reply
  );
}