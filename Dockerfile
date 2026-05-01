# syntax=docker/dockerfile:1.7

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Build the app. The Maps key is baked into the JS bundle; restrict it by
# HTTP referrer in Google Cloud Console rather than relying on it staying secret.
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_GOOGLE_MAPS_MAP_ID=""
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_MAP_ID=$VITE_GOOGLE_MAPS_MAP_ID

COPY . .
RUN npm run build

# ─── Stage 2: runtime (nginx) ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replace default config and drop the build artefacts in place.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck: nginx should respond on /
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
