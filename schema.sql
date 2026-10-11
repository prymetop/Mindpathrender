CREATE TABLE IF NOT EXISTS conversations (
  chat_id TEXT PRIMARY KEY,
  history_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_key TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at
ON processed_events(processed_at);
CREATE TABLE IF NOT EXISTS image_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  caption TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_context_chat_expiry
ON image_context(chat_id, expires_at);