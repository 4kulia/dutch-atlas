import type { Lang } from '../types';

const PLURAL_FORMS = {
  notes: {
    ru: ['заметка', 'заметки', 'заметок'],
    en: ['note', 'notes', 'notes'],
  },
} as const;

type PluralKey = keyof typeof PLURAL_FORMS;

function ruPluralIndex(n: number): 0 | 1 | 2 {
  const abs = Math.abs(n) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return 2;
  if (tail === 1) return 0;
  if (tail >= 2 && tail <= 4) return 1;
  return 2;
}

function enPluralIndex(n: number): 0 | 1 {
  return n === 1 ? 0 : 1;
}

export function plural(key: PluralKey, n: number, lang: Lang): string {
  const forms = PLURAL_FORMS[key][lang];
  const idx = lang === 'ru' ? ruPluralIndex(n) : enPluralIndex(n);
  return `${n} ${forms[idx]}`;
}
