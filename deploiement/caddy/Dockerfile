# Caddy + module de limitation de débit (github.com/mholt/caddy-ratelimit).
# Images de base épinglées par digest (relevés le 2026-10-11) ; module épinglé par commit.
# Mise à jour : relever les nouveaux digests/commit, reconstruire (docker compose build caddy).
FROM caddy:2-builder@sha256:b25f47453fa02f7e66c0828b4b1343658808b9000950b6825c4a1cb0c988f5f8 AS build
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@5625512f24f6f59d6f64fb3aafe5eecff0b286db

FROM caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f
COPY --from=build /usr/bin/caddy /usr/bin/caddy
