FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Sentry necesita estar presente en build time porque @sentry/astro se inyecta
# como Astro integration durante `npm run build`. Si SENTRY_DSN llega vacio,
# la integration no se carga (no-op) y el build sigue normal.
ARG SENTRY_DSN=""
ARG SENTRY_ENVIRONMENT="production"
ARG SENTRY_TRACES_SAMPLE_RATE="0.1"
ENV SENTRY_DSN=$SENTRY_DSN
ENV SENTRY_ENVIRONMENT=$SENTRY_ENVIRONMENT
ENV SENTRY_TRACES_SAMPLE_RATE=$SENTRY_TRACES_SAMPLE_RATE

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
