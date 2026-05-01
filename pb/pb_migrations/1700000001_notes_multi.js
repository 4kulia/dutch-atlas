/// <reference path="../pb_data/types.d.ts" />
//
// Switches `notes` from one-per-(user, attraction) to many-per. The drawer
// now shows each note as a separate record with its own delete button.

migrate(
  (app) => {
    const notes = app.findCollectionByNameOrId('notes');
    notes.indexes = [
      'CREATE INDEX idx_notes_user_attraction ON notes (user, attraction_id)',
    ];
    app.save(notes);
  },
  (app) => {
    const notes = app.findCollectionByNameOrId('notes');
    notes.indexes = [
      'CREATE UNIQUE INDEX idx_note_user_attraction ON notes (user, attraction_id)',
    ];
    app.save(notes);
  },
);
