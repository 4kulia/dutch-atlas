# Netherlands Attractions Map · Карта достопримечательностей Нидерландов

Интерактивная двуязычная (RU/EN) карта ~99 достопримечательностей Нидерландов
из видео https://youtu.be/8O8TIoHpKXQ. При клике на маркер открывается
панель с описанием и встроенным YouTube‑плеером, который автоматически
играет с нужного таймкода.

## Стек

- **Vite + React 18 + TypeScript**
- **Tailwind CSS**
- **`@vis.gl/react-google-maps`** + `@googlemaps/markerclusterer`
- **PocketBase** (Go-бинарь в Docker) — auth + БД для избранного и заметок
- YouTube IFrame API (без отдельной либы)

## Локальный запуск

```bash
# 1. Установить зависимости
npm install

# 2. Получить Google Maps API key — см. раздел ниже.
cp .env.example .env.local
# Отредактируйте .env.local — VITE_GOOGLE_MAPS_API_KEY и VITE_POCKETBASE_URL.

# 3. Запустить PocketBase (бэкенд для auth + избранного + заметок)
docker compose up -d pb
# → http://localhost:8090/_/   (админка)
# → http://localhost:8090/api/ (REST API)

# 4. Запустить dev-сервер
npm run dev
# → http://localhost:5173
```

## Скрипты

| Команда                     | Что делает                                                           |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run dev`               | Vite dev server (HMR) на 5173                                        |
| `npm run build`             | Production-сборка в `dist/`                                          |
| `npm run preview`           | Preview production-сборки локально                                    |
| `npm run typecheck`         | Только проверка типов (без сборки)                                   |
| `node scripts/prepare-data.mjs` | Парсит docs/* и собирает базовый `data/attractions.base.json`     |
| `node scripts/merge-data.mjs`   | Мёрджит base + enrichments → итоговый `data/attractions.json`     |

## Google Maps API key

1. https://console.cloud.google.com → создать или выбрать проект.
2. **APIs & Services → Library** — включить **Maps JavaScript API**.
3. **Credentials → Create credentials → API key**.
4. На созданном ключе:
   - **Application restrictions → HTTP referrers**:
     - `http://localhost:5173/*`
     - `http://localhost:8080/*`
     - `http://localhost:4173/*`
     - `https://your-domain.com/*` (продовый домен)
   - **API restrictions → Selected APIs**: только **Maps JavaScript API**.
5. **Billing**: привязать аккаунт с биллингом (без него Maps JS не работает,
   но есть бесплатная квота $200/мес).
6. Поставить **Budget alert** на $1–5/мес как страховку.
7. Скопировать ключ в `.env.local`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=AIza...
   ```

> Ключ `VITE_*` попадает в клиентский бандл и виден в браузере — это нормально
> для Maps JS API. Защита — через HTTP-referrer ограничения, не через
> секретность ключа.

### (Опционально) Map ID для AdvancedMarker

Чтобы получить более чистый стиль карты и поддержку `AdvancedMarker` без
предупреждений в консоли:

1. **Google Maps Platform → Map management → Create new Map ID**
2. Тип: **JavaScript**
3. Скопировать Map ID в `.env.local`:
   ```
   VITE_GOOGLE_MAPS_MAP_ID=ваш-map-id
   ```

Без указания Map ID используется дефолтный fallback.

## Аутентификация (Google OAuth + PocketBase)

При первом запуске `docker compose up -d pb` PocketBase автоматически
создаёт коллекции `users`, `favorites`, `notes` (см. `pb/pb_migrations/`).

### Шаг 1. Создать superuser PocketBase

1. Открыть **http://localhost:8090/_/** — на первом заходе появится форма
   создания админ-аккаунта (нужен только разработчику для управления PB).
2. Введите email + пароль, запомните.

### Шаг 2. Создать OAuth Client в Google Cloud Console

1. https://console.cloud.google.com → ваш проект.
2. **APIs & Services → OAuth consent screen** — настроить External app:
   - App name, support email, developer contact.
   - В тестовом режиме добавьте свои Google-emails в **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins:**
     - `http://localhost:5173`
     - `http://localhost:8080`
     - `https://your-domain.com` (прод)
   - **Authorized redirect URIs:**
     - `http://localhost:8090/api/oauth2-redirect`
     - `https://your-domain.com/pb/api/oauth2-redirect` (прод)
4. Скопировать **Client ID** и **Client Secret**.

### Шаг 3. Подключить Google в PocketBase

**Вариант А — через скрипт (рекомендуется).** Если у вас на руках
`client_secret_<id>.json` из Google Cloud (Credentials → Download JSON),
запустите:

```bash
POCKETBASE_ADMIN_EMAIL=you@example.com \
POCKETBASE_ADMIN_PASSWORD='ваш-пароль-PB-админа' \
node scripts/setup-pb-oauth.mjs path/to/client_secret_xxx.json
```

Скрипт прочитает файл локально, авторизуется в PB и проставит Client ID/Secret
+ включит OAuth2 в коллекции users. Ничего не нужно копировать вручную.

**Вариант Б — вручную через админку.** В **Settings → Auth providers → Google**
введите Client ID и Client Secret из Google Cloud Console. В
**Collections → users → Edit → Options**: включите ✅ **OAuth2**.

### Шаг 4. Тест

`npm run dev` → http://localhost:5173 → клик «Войти через Google» в
шапке → попап → выбор аккаунта → видите свой аватар вместо кнопки.

После входа в drawer достопримечательности появятся:
- Кнопка-сердечко «В избранное»
- Секция «Мои заметки» (приватный текст, виден только вам)

В фильтре сверху появится чип «Избранное N» — фильтр по сохранённым.

## Деплой через Docker

Образ собирается multi-stage (node → nginx) и слушает на `127.0.0.1:8080`.
Перед ним должен стоять серверный nginx с TLS (см. пример ниже).

### Сборка и запуск

```bash
# В .env рядом с docker-compose.yml:
echo "VITE_GOOGLE_MAPS_API_KEY=AIza..." > .env

docker compose build
docker compose up -d
docker compose logs -f web
```

После запуска: `curl -I http://127.0.0.1:8080/` должен вернуть `200 OK`.

### Полный шаг‑за‑шагом деплой на сервер (`dutch-atlas.com`)

Один раз настроить:

```bash
# 1. Установить Docker + compose plugin (если ещё нет)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # перелогиньтесь

# 2. Склонировать репо
cd /opt
sudo mkdir dutch-atlas && sudo chown $USER:$USER dutch-atlas
git clone https://github.com/4kulia/dutch-atlas.git dutch-atlas
cd dutch-atlas

# 3. Создать .env с production-ключом Google Maps
cat > .env <<EOF
VITE_GOOGLE_MAPS_API_KEY=AIza...prod_key
VITE_POCKETBASE_URL=/pb
EOF

# 4. Запустить контейнеры
docker compose up -d

# 5. Создать PocketBase superuser
docker compose exec pb /pb/pocketbase superuser upsert your-email@example.com 'StrongPasswordHere'

# 6. Подключить Google OAuth (см. Раздел "Аутентификация" выше — Шаг 3)
#    Загрузите client_secret_*.json на сервер (scp), затем:
POCKETBASE_URL=http://localhost:8090 \
POCKETBASE_ADMIN_EMAIL=your-email@example.com \
POCKETBASE_ADMIN_PASSWORD='StrongPasswordHere' \
node scripts/setup-pb-oauth.mjs /path/to/client_secret_xxx.json
#    (или вручную в http://localhost:8090/_/ через SSH-туннель)

# 7. Настроить host nginx (см. ниже) и certbot
sudo certbot --nginx -d dutch-atlas.com
```

После каждого `git pull`:
```bash
docker compose build && docker compose up -d
```

### Пример конфига host nginx (reverse proxy + TLS)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # PocketBase (auth + БД)
    location /pb/ {
        proxy_pass         http://127.0.0.1:8090/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        # PB realtime (server-sent events) и большие тела (uploads)
        proxy_buffering off;
        client_max_body_size 50M;
    }

    # Статика фронта
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

После деплоя на прод:
1. Добавить продовый домен в HTTP-referrer ограничения Google Maps API key.
2. Добавить `https://your-domain.com` в **Authorized origins** OAuth Client.
3. Добавить `https://your-domain.com/pb/api/oauth2-redirect` в **Authorized redirect URIs**.

## Структура проекта

```
nl_attractions/
├── docs/                       # исходные данные (timecodes.md, transcript.json)
├── data/
│   ├── attractions.base.json   # авто-сгенерировано, base RU данные
│   └── attractions.json        # итоговый источник истины (RU+EN, координаты)
├── scripts/
│   ├── prepare-data.mjs        # парсер MD + транскрипта
│   ├── enrichments.mjs         # координаты и EN-переводы (вручную)
│   └── merge-data.mjs          # сборка финального JSON
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/             # MapView, Drawer, Header, Filter, Toggle, …
│   ├── i18n/                   # LanguageProvider + строки UI
│   ├── data/                   # типизированный импорт attractions.json
│   ├── types.ts
│   └── index.css
├── docker/nginx.conf
├── Dockerfile
├── docker-compose.yml
└── …
```

## Обновление данных

Если поправили `docs/netherlands_attractions_timecodes.md` или
`scripts/enrichments.mjs`:

```bash
node scripts/prepare-data.mjs
node scripts/merge-data.mjs
```

`data/attractions.json` пересобирается из обоих источников.
