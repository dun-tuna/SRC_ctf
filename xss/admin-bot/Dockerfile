FROM node:20-alpine

# Puppeteer dependencies
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /bot

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "admin-bot.js"]
