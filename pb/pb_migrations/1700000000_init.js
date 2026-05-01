/// <reference path="../pb_data/types.d.ts" />
//
// Schema bootstrap for nl_attractions.
//
// Creates two private collections:
//   - favorites: a (user, attraction_id) pair; uniqueness ensures heart toggles cleanly.
//   - notes:     per-user, per-attraction free-text body, edited in the drawer.
//
// All rules require an authenticated user owning the row. Rows are not visible
// to other users — these are personal travel notes, not public reviews.
//
// PocketBase v0.23+ migration syntax: uses `app.save(collection)` and
// `fields` array (replaced `schema` from older versions).

migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users');

    // ── favorites ────────────────────────────────────────────────────
    const favorites = new Collection({
      name: 'favorites',
      type: 'base',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'attraction_id',
          type: 'text',
          required: true,
          max: 100,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_fav_user_attraction ON favorites (user, attraction_id)',
      ],
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    });
    app.save(favorites);

    // ── notes ────────────────────────────────────────────────────────
    const notes = new Collection({
      name: 'notes',
      type: 'base',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'attraction_id',
          type: 'text',
          required: true,
          max: 100,
        },
        {
          name: 'body',
          type: 'text',
          required: true,
          max: 10000,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_note_user_attraction ON notes (user, attraction_id)',
      ],
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    });
    app.save(notes);
  },
  (app) => {
    for (const name of ['notes', 'favorites']) {
      try {
        const col = app.findCollectionByNameOrId(name);
        app.delete(col);
      } catch (_) {
        /* collection didn't exist — fine */
      }
    }
  },
);
