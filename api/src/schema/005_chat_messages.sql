-- Chat history with the AI assistant. Per-user, ordered by created_at.
-- ui_events stores the side-effect signals (map.show / drawer.open / cards)
-- so the conversation can be replayed on another device.

CREATE TABLE chat_messages (
  id text PRIMARY KEY,                              -- ULID
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  ui_events jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_user_created_idx ON chat_messages (user_id, created_at);
