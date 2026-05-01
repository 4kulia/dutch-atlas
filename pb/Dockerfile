# syntax=docker/dockerfile:1.7
FROM alpine:3.20

ARG PB_VERSION=0.26.0

RUN apk add --no-cache ca-certificates unzip wget tini \
    && ARCH="$(uname -m)" \
    && case "$ARCH" in \
         x86_64)  PB_ARCH=amd64 ;; \
         aarch64) PB_ARCH=arm64 ;; \
         armv7l)  PB_ARCH=armv7 ;; \
         *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
       esac \
    && wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && rm -rf /var/cache/apk/*

WORKDIR /pb

# Migrations are applied automatically on startup.
COPY pb_migrations /pb/pb_migrations

EXPOSE 8090

# /pb/pb_data persists collections, files, and the SQLite db across restarts.
VOLUME ["/pb/pb_data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
