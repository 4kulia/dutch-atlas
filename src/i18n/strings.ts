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
  more_filters: { ru: 'Ещё', en: 'More' },
  more_filters_count: { ru: 'выбрано', en: 'selected' },
  filter_panel_title: { ru: 'Все категории', en: 'All categories' },
  filter_panel_close: { ru: 'Готово', en: 'Done' },
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
  museum: { ru: 'Музеи', en: 'Museums' },
  monument: { ru: 'Памятники', en: 'Monuments' },
  architecture: { ru: 'Архитектура', en: 'Architecture' },
  coastal: { ru: 'Побережье', en: 'Coastal' },
  religious: { ru: 'Религиозные места', en: 'Religious sites' },
  industrial: { ru: 'Промышленность', en: 'Industrial' },
  street_art: { ru: 'Стрит-арт', en: 'Street art' },
  dark_legend: { ru: 'Тёмные легенды', en: 'Dark legends' },
  oddity: { ru: 'Странности', en: 'Oddities' },
  other: { ru: 'Прочие места', en: 'Other places' },
};

// Controlled tag vocabulary — must mirror scripts/seed-attractions.mjs ALLOWED_TAGS.
// Used for tag chips in drawer + (future) tag filter.
export const TAG_LABEL: Record<string, { ru: string; en: string }> = {
  // theme
  art:           { ru: 'Искусство',     en: 'Art' },
  music:         { ru: 'Музыка',        en: 'Music' },
  science:       { ru: 'Наука',         en: 'Science' },
  nature:        { ru: 'Природа',       en: 'Nature' },
  history:       { ru: 'История',       en: 'History' },
  military:      { ru: 'Военное',       en: 'Military' },
  religion:      { ru: 'Религия',       en: 'Religion' },
  food:          { ru: 'Еда',           en: 'Food' },
  sport:         { ru: 'Спорт',         en: 'Sport' },
  technology:    { ru: 'Технологии',    en: 'Technology' },
  // era
  medieval:      { ru: 'Средневековье',     en: 'Medieval' },
  golden_age:    { ru: 'Золотой век',       en: 'Golden Age' },
  industrial_era:{ ru: 'Эпоха индустрии',   en: 'Industrial era' },
  wwii:          { ru: 'Вторая мировая',    en: 'WWII' },
  cold_war:      { ru: 'Холодная война',    en: 'Cold War' },
  modern_arch:   { ru: 'Современная архитектура', en: 'Modern architecture' },
  // vibe
  quirky:          { ru: 'Странное',        en: 'Quirky' },
  spooky:          { ru: 'Жуткое',          en: 'Spooky' },
  romantic:        { ru: 'Романтика',       en: 'Romantic' },
  family_friendly: { ru: 'Для всей семьи',  en: 'Family-friendly' },
  dark_tourism:    { ru: 'Тёмный туризм',   en: 'Dark tourism' },
  hidden_gem:      { ru: 'Скрытая жемчужина', en: 'Hidden gem' },
  photogenic:      { ru: 'Фотогеничное',    en: 'Photogenic' },
  legend:          { ru: 'Легенда',         en: 'Legend' },
  ghost_story:     { ru: 'История с призраками', en: 'Ghost story' },
  eccentric:       { ru: 'Эксцентричное',   en: 'Eccentric' },
  mural:           { ru: 'Мурал',           en: 'Mural' },
  urban_art:       { ru: 'Уличное искусство', en: 'Urban art' },
  largest_in_world:{ ru: 'Крупнейшее в мире', en: 'Largest in the world' },
  oldest_in_country:{ ru: 'Старейшее в стране', en: 'Oldest in the country' },
  // practical
  unesco:        { ru: 'ЮНЕСКО',           en: 'UNESCO' },
  free_entry:    { ru: 'Бесплатный вход',  en: 'Free entry' },
  seasonal:      { ru: 'Сезонное',         en: 'Seasonal' },
  byo_bike:      { ru: 'Свой велосипед',   en: 'Bring your bike' },
  ticketed_only: { ru: 'По билетам',       en: 'Ticketed only' },
  indoor:        { ru: 'В помещении',      en: 'Indoor' },
  outdoor:       { ru: 'На улице',         en: 'Outdoor' },
};

// "Primary" categories — always visible in the filter bar. The rest is
// behind a "+ More" popover. Picked by frequency × user-relevance.
export const PRIMARY_CATEGORIES: Category[] = [
  'city_large',
  'city_historic',
  'village',
  'nature',
  'castle',
  'museum',
];

export function t(key: keyof typeof UI, lang: Lang): string {
  return UI[key][lang];
}
