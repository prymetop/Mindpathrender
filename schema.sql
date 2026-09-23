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
