FROM node:20-bookworm-slim AS base

# Playwright (PDF export) needs its browser + OS deps present in the image.
RUN apt-get update && apt-get install -y --no-install-recursive \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY package.json next.config.ts ./

RUN npx playwright install --with-deps chromium

EXPOSE 3000
CMD ["npm", "start"]
