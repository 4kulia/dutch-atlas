# Build stage — TypeScript → JS in /app/dist
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage — production deps only
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Sharp 0.33 ships prebuilt linux-musl binaries; vips is a runtime fallback
# in case the prebuild can't load on this libc/architecture combination.
RUN apk add --no-cache vips
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src/schema ./dist/schema
RUN mkdir -p /app/uploads

EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:8091/api/health || exit 1

CMD ["node", "dist/index.js"]
