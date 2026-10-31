# ---- build stage: compile TypeScript ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# ---- runtime stage: Chrome libraries, production dependencies, compiled code ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# System libraries Chrome needs (slim images ship without apt package lists)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation wget xdg-utils \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 \
    libcups2 libcurl4 libdbus-1-3 libexpat1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libvulkan1 libx11-6 \
    libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxkbcommon0 libxrandr2 \
 && rm -rf /var/lib/apt/lists/*

# puppeteer.config.cjs makes Chrome install under /app/.cache/puppeteer
COPY package*.json puppeteer.config.cjs ./
RUN npm ci --omit=dev
RUN npx puppeteer browsers install chrome
RUN chown -R node:node /app

COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]