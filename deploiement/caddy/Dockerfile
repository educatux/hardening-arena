# Caddy + module de limitation de débit (github.com/mholt/caddy-ratelimit).
# Images de base épinglées par digest (relevés le 2026-10-11) ; module épinglé par commit.
# Mise à jour : relever les nouveaux digests/commit, reconstruire (docker compose build caddy).
FROM caddy:2-builder@sha256:b25f47453fa02f7e66c0828b4b1343658808b9000950b6825c4a1cb0c988f5f8 AS build
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@5625512f24f6f59d6f64fb3aafe5eecff0b286db

FROM caddy:2-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9
COPY --from=build /usr/bin/caddy /usr/bin/caddy
