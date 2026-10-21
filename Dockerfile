# Shared dependency stage
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Development
FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# Production
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
