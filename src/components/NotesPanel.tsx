import { useEffect, useRef, useState } from 'react';
import { useNotes, type NoteRecord } from '../auth/useNotes';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';
import type { Lang } from '../types';

// Strings file used to have a single "заметок" suffix; now plural rules
// are handled in i18n/plurals.ts. UI.notes_count remains for compatibility
// with existing translations.

interface Props {
  attractionId: string;
}

export function NotesPanel({ attractionId }: Props) {
  const { notes, add, remove, isLoading, isSaving } = useNotes(attractionId);
  const { lang } = useLang();
  const [draft, setDraft] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the draft textarea to its content.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 88)}px`;
  }, [draft]);

  // Clear the draft when switching to a different attraction.
  useEffect(() => {
    setDraft('');
  }, [attractionId]);

  const handleAdd = async () => {
    const value = draft.trim();
    if (!value) return;
    try {
      await add(value);
      setDraft('');
    } catch {
      /* error logged in hook */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter quickly submits.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-ink-700/40 bg-ink-900/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink-100">{UI.notes_title[lang]}</h3>

      <ul className="space-y-2">
        {!isLoading && notes.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-700/40 px-3 py-4 text-center text-[12px] text-ink-500">
            {UI.notes_empty[lang]}
          </li>
        )}
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} lang={lang} onDelete={() => remove(n.id)} />
        ))}
      </ul>

      <div className="mt-4 border-t border-ink-700/40 pt-4">
        <textarea
          ref={textRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={UI.notes_placeholder[lang]}
          disabled={isSaving}
          className="block w-full resize-none rounded-lg border border-ink-700/40 bg-ink-950/60 px-3 py-2 text-[14px] leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
          rows={3}
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={isSaving || !draft.trim()}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-[12px] font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isSaving ? UI.notes_adding[lang] : UI.notes_add[lang]}
          </button>
        </div>
      </div>
    </section>
  );
}

interface NoteCardProps {
  note: NoteRecord;
  lang: Lang;
  onDelete: () => void;
}

// PocketBase serialises timestamps as "YYYY-MM-DD HH:MM:SS.sssZ" with a space
// between the date and time — non-ISO. Patch it before parsing.
function parsePbDate(value: string): Date | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function NoteCard({ note, lang, onDelete }: NoteCardProps) {
  const created = parsePbDate(note.created);
  const formatted = created
    ? created.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <li className="rounded-lg border border-ink-700/40 bg-ink-950/40 px-3 py-2.5">
      <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-100">{note.body}</p>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <time dateTime={note.created} className="text-ink-500">
          {formatted}
        </time>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full px-2 py-0.5 text-ink-500 transition-colors hover:bg-ink-800/60 hover:text-accent"
          aria-label={UI.notes_delete[lang]}
        >
          {UI.notes_delete[lang]}
        </button>
      </div>
    </li>
  );
}
