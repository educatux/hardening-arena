# Hardening Arena (buzz) par BlueTeam Academy.
# Contexte de build = dossier parent (diagnostic/) pour embarquer ../commun :
#   docker compose up -d --build          (depuis quiz-buzz/, voir docker-compose.yml)
#   docker build -f quiz-buzz/Dockerfile . (depuis diagnostic/)
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
ENV NODE_ENV=production PORT=8080
# Même arborescence que le dépôt : /srv/quiz-buzz + /srv/commun
WORKDIR /srv/quiz-buzz
COPY quiz-buzz/package.json quiz-buzz/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY quiz-buzz/server.js ./
# Un fichier <id>.json par quiz (généré par questions/build.py) ; QUIZZES_DIR pour un autre dossier
COPY quiz-buzz/quizzes ./quizzes
COPY quiz-buzz/public ./public
COPY commun /srv/commun
# Fichiers appartenant à root, lisibles seulement : compatible avec read_only: true
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
