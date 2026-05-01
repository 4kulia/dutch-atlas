import type { Category, Lang } from '../types';

type Dict = Record<string, { ru: string; en: string }>;

export const UI: Dict = {
  app_title: {
    ru: 'Достопримечательности Нидерландов',
    en: 'Netherlands Attractions',
  },
  app_subtitle: {
    ru: 'По мотивам видео',
    en: 'Based on the video',
  },
  source_video: {
    ru: 'Исходное видео',
    en: 'Original video',
  },
  show_more: {
    ru: 'Подробнее',
    en: 'Read more',
  },
  show_less: {
    ru: 'Свернуть',
    en: 'Show less',
  },
  open_in_youtube: {
    ru: 'Открыть на YouTube',
    en: 'Watch on YouTube',
  },
  close: {
    ru: 'Закрыть',
    en: 'Close',
  },
  filter: {
    ru: 'Категории',
    en: 'Categories',
  },
  all_categories: {
    ru: 'Все',
    en: 'All',
  },
  clear: {
    ru: 'Очистить',
    en: 'Clear',
  },
  api_key_missing: {
    ru: 'Не задан Google Maps API ключ. Создайте .env.local с VITE_GOOGLE_MAPS_API_KEY.',
    en: 'Google Maps API key is missing. Create .env.local with VITE_GOOGLE_MAPS_API_KEY.',
  },
  list_button: {
    ru: 'Список',
    en: 'List',
  },
  search_placeholder: {
    ru: 'Поиск по названию…',
    en: 'Search by name…',
  },
  no_results: {
    ru: 'Ничего не найдено',
    en: 'Nothing found',
  },
  apply: {
    ru: 'Применить',
    en: 'Apply',
  },
  attractions_count: {
    ru: 'мест',
    en: 'places',
  },
  short_title: {
    ru: 'Карта',
    en: 'Map',
  },
  audio_hint: {
    ru: 'Аудио на русском есть в плеере — нажмите ⚙️ → «Аудиодорожка» → «Русский».',
    en: 'Original English audio is the default. To change the dub, click ⚙ → “Audio track”.',
  },
  open_in_maps: {
    ru: 'Открыть в Google Maps',
    en: 'Open in Google Maps',
  },
  share: { ru: 'Поделиться', en: 'Share' },
  share_copied: { ru: 'Ссылка скопирована', en: 'Link copied' },
  my_places: { ru: 'Мои места', en: 'My places' },
  my_places_empty: {
    ru: 'Здесь будут появляться места, которые вы сохраните в избранное или о которых сделаете заметку.',
    en: 'Places you save to favorites or write notes about will appear here.',
  },
  my_places_favorites: { ru: 'Избранное', en: 'Favorites' },
  my_places_with_notes: { ru: 'С заметками', en: 'With notes' },
  my_places_notes_count: {
    ru: 'заметок',
    en: 'notes',
  },
  favorite_add: { ru: 'В избранное', en: 'Save' },
  favorite_remove: { ru: 'В избранном', en: 'Saved' },
  favorite_login_required: {
    ru: 'Войдите через Google, чтобы сохранять места и оставлять заметки.',
    en: 'Sign in with Google to save places and add personal notes.',
  },
  visited_add: { ru: 'Я был', en: "I've been" },
  visited_remove: { ru: 'Был', en: 'Been' },
  visited_section: { ru: 'Где я был', en: "Places I've been" },
  hide_visited: { ru: 'Без посещённых', en: 'Hide visited' },
  hide_visited_off: { ru: 'Все', en: 'All' },
  notes_title: { ru: 'Мои заметки', en: 'My notes' },
  notes_placeholder: {
    ru: 'Запишите, что хотите запомнить про это место…',
    en: 'Jot down what you want to remember about this place…',
  },
  notes_add: { ru: 'Добавить', en: 'Add' },
  notes_adding: { ru: 'Добавляю…', en: 'Adding…' },
  notes_delete: { ru: 'Удалить', en: 'Delete' },
  notes_empty: { ru: 'Пока заметок нет', en: 'No notes yet' },
  favorites_only: { ru: 'Избранное', en: 'Favorites' },
};

export const CATEGORY_LABEL: Record<Category, { ru: string; en: string }> = {
  city_large: { ru: 'Крупные города', en: 'Major cities' },
  city_historic: { ru: 'Исторические города', en: 'Historic towns' },
  village: { ru: 'Деревни', en: 'Villages' },
  nature: { ru: 'Природа', en: 'Nature' },
  hydraulic: { ru: 'Гидротехника', en: 'Hydraulic works' },
  wind: { ru: 'Ветроэлектростанции', en: 'Wind farms' },
  castle: { ru: 'Замки', en: 'Castles' },
  caribbean: { ru: 'Карибы', en: 'Caribbean' },
  other: { ru: 'Прочие места', en: 'Other places' },
};

export function t(key: keyof typeof UI, lang: Lang): string {
  return UI[key][lang];
}
