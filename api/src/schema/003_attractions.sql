-- The attractions catalogue. Curated rows seeded from data/attractions.json,
-- user-submitted rows go through draft → pending → published moderation.
--
-- Two embedding columns (one per language) are stored alongside the row for
-- vector similarity search via pgvector.

CREATE TABLE attractions (
  id text PRIMARY KEY,                          -- slug (human-readable, used in URLs)
  category text NOT NULL,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  short_ru text,
  short_en text,
  full_ru text,
  full_en text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,

  video_id text,
  video_time integer,
  video_time_fmt text,

  author_id text REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('curated', 'user')),
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'rejected')),

  -- Vector columns. voyage-3.5 returns 1024-dim float vectors.
  embedding_ru vector(1024),
  embedding_en vector(1024),
  embedding_hash_ru text,
  embedding_hash_en text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attractions_status_idx ON attractions(status);
CREATE INDEX attractions_author_idx ON attractions(author_id);
CREATE INDEX attractions_category_idx ON attractions(category);

-- ivfflat indexes need lists tuned to row count: ~sqrt(n). We have 99 rows;
-- start with 10. Recreate with WITH (lists = ...) once user submissions
-- push the row count past a few thousand.
CREATE INDEX attractions_embedding_ru_idx
  ON attractions USING ivfflat (embedding_ru vector_cosine_ops)
  WITH (lists = 10);
CREATE INDEX attractions_embedding_en_idx
  ON attractions USING ivfflat (embedding_en vector_cosine_ops)
  WITH (lists = 10);
