-- Group chat messages into named sessions so the user can keep separate
-- conversations and switch between them. Each session belongs to one user.

CREATE TABLE chat_sessions (
  id text PRIMARY KEY,                                  -- ULID
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Новый чат',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_sessions_user_updated_idx ON chat_sessions(user_id, updated_at DESC);

-- Messages now belong to a session. We allow NULL during the migration
-- window so any pre-existing rows aren't lost; new inserts always set it.
ALTER TABLE chat_messages
  ADD COLUMN session_id text REFERENCES chat_sessions(id) ON DELETE CASCADE;

CREATE INDEX chat_messages_session_idx ON chat_messages(session_id, created_at);
