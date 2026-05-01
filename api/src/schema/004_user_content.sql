-- Per-user content: favourites (heart toggles) and free-form notes.
--
-- favorites is a many-to-many with composite PK; notes are individual rows
-- (the drawer renders each note as its own card with delete button).

CREATE TABLE favorites (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attraction_id text NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, attraction_id)
);

CREATE TABLE notes (
  id text PRIMARY KEY,                          -- ULID
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attraction_id text NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_user_attraction_idx ON notes (user_id, attraction_id);
CREATE INDEX notes_user_created_idx ON notes (user_id, created_at DESC);
