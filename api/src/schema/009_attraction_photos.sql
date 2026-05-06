-- Photos for user-submitted attractions. A row with NULL attraction_id is a
-- "limbo" upload: the file is on disk but not yet attached to a place. The
-- save_place_draft tool fills in attraction_id when the user submits. A
-- daily cleanup deletes orphans older than 24 h (cron'd via the seed-script
-- runner or a manual SQL — out of scope for v1).

CREATE TABLE IF NOT EXISTS attraction_photos (
  id text PRIMARY KEY,                    -- ulid
  attraction_id text REFERENCES attractions(id) ON DELETE CASCADE,
  uploaded_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,                      -- path under /api/uploads/
  width int,
  height int,
  exif_lat double precision,
  exif_lng double precision,
  exif_taken_at timestamptz,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attraction_photos_attraction_idx
  ON attraction_photos(attraction_id, position);
CREATE INDEX IF NOT EXISTS attraction_photos_uploader_idx
  ON attraction_photos(uploaded_by, created_at);

-- Extra columns for user-submitted places: GPS/manual-pick accuracy and
-- the timestamp at which the user pressed "submit" (vs. just-saved-draft).
ALTER TABLE attractions
  ADD COLUMN IF NOT EXISTS location_accuracy_m real,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_note text;
