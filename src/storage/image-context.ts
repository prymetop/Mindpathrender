import type { Env } from "../types";

const IMAGE_CONTEXT_TTL_MS = 30 * 60 * 1000;
const MAX_RECENT_IMAGES = 5;

export interface ImageContextItem {
file_id: string;
mime_type: string;
caption: string | null;
created_at: number;
}

export async function saveImageReference(
env: Env,
chatId: number,
fileId: string,
mimeType = "image/jpeg",
caption?: string
): Promise<void> {
const now = Date.now();

// Remove expired image references for this conversation.
await env.DB
.prepare(`       DELETE FROM image_context
      WHERE chat_id = ? AND expires_at <= ?
    `)
.bind(String(chatId), now)
.run();

// Save the reference and its expiry time.
await env.DB
.prepare(`       INSERT INTO image_context
        (chat_id, file_id, mime_type, caption, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
.bind(
String(chatId),
fileId,
mimeType,
caption?.trim() || null,
now,
now + IMAGE_CONTEXT_TTL_MS
)
.run();

// Keep the most recent five image references for this conversation.
await env.DB
.prepare(`       DELETE FROM image_context
      WHERE chat_id = ?
        AND id NOT IN (
          SELECT id
          FROM image_context
          WHERE chat_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        )
    `)
.bind(String(chatId), String(chatId), MAX_RECENT_IMAGES)
.run();
}

export async function getRecentImageReferences(
env: Env,
chatId: number
): Promise<ImageContextItem[]> {
const now = Date.now();

// Clean up expired references before retrieving recent images.
await env.DB
.prepare(`       DELETE FROM image_context
      WHERE chat_id = ? AND expires_at <= ?
    `)
.bind(String(chatId), now)
.run();

const result = await env.DB
.prepare(`       SELECT file_id, mime_type, caption, created_at
      FROM image_context
      WHERE chat_id = ? AND expires_at > ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `)
.bind(String(chatId), now, MAX_RECENT_IMAGES)
.all<ImageContextItem>();

// Return oldest to newest so the image order is predictable.
return (result.results ?? []).reverse();
}

export async function clearImageContext(
env: Env,
chatId: number
): Promise<void> {
await env.DB
.prepare("DELETE FROM image_context WHERE chat_id = ?")
.bind(String(chatId))
.run();
}
