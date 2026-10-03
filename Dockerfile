FROM node:24.9.0-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4178 PASSWORD_FILE=/data/password.json DATABASE_PATH=/data/playbook.sqlite MEDIA_DIR=/data/media
WORKDIR /app
COPY package.json package-lock.json ./
COPY config/categories.txt ./config/categories.txt
RUN npm ci --omit=dev
COPY dist ./dist
COPY site-dist ./site-dist
USER node
EXPOSE 4178
CMD ["node", "dist/src/server.js"]
