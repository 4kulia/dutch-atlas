-- "I've been here" log per user. Composite PK like favourites — a place is
-- either visited or not, no row history. We keep created_at for "recently
-- marked" sorting in My Places later, but `visited_at` (when the user
-- actually went) we don't ask for at the toggle level — keeps the UX one tap.

CREATE TABLE visits (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attraction_id text NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, attraction_id)
);

CREATE INDEX visits_user_created_idx ON visits (user_id, created_at DESC);
