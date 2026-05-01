-- Extend the category whitelist with finer-grained types and add a free-form
-- tags column for orthogonal labels (theme/era/vibe/practical).
--
-- Categories are mutually exclusive ("one category per place"); tags are
-- multiple-per-place and live in a controlled vocabulary enforced by
-- scripts/seed-attractions.mjs. We don't enforce the vocabulary at the SQL
-- layer to keep migrations cheap — adding a new tag is a one-line change in
-- the seed script.

ALTER TABLE attractions DROP CONSTRAINT IF EXISTS attractions_category_check;

ALTER TABLE attractions
  ADD CONSTRAINT attractions_category_check CHECK (category IN (
    'caribbean','castle','city_historic','city_large','hydraulic','nature',
    'village','wind','other',
    'museum','monument','architecture','coastal','religious','industrial',
    'street_art','dark_legend','oddity'
  ));

ALTER TABLE attractions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS attractions_tags_gin_idx ON attractions USING gin(tags);
