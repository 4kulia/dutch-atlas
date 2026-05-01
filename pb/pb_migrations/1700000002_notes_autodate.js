/// <reference path="../pb_data/types.d.ts" />
//
// PocketBase v0.23+ removed implicit `created` / `updated` columns. Each
// collection that needs timestamps must declare them as `autodate` fields.
// Without this, NoteCard renders "Invalid Date" and ordering by `-created`
// silently no-ops.

migrate(
  (app) => {
    for (const name of ['notes', 'favorites']) {
      const col = app.findCollectionByNameOrId(name);

      if (!col.fields.getByName('created')) {
        col.fields.add(
          new AutodateField({
            name: 'created',
            onCreate: true,
            onUpdate: false,
          }),
        );
      }
      if (!col.fields.getByName('updated')) {
        col.fields.add(
          new AutodateField({
            name: 'updated',
            onCreate: true,
            onUpdate: true,
          }),
        );
      }

      app.save(col);
    }
  },
  (app) => {
    for (const name of ['notes', 'favorites']) {
      const col = app.findCollectionByNameOrId(name);
      const created = col.fields.getByName('created');
      if (created) col.fields.removeById(created.id);
      const updated = col.fields.getByName('updated');
      if (updated) col.fields.removeById(updated.id);
      app.save(col);
    }
  },
);
