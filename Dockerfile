# syntax=docker/dockerfile:1
FROM oven/bun:1.3.4 AS bun

FROM node:22-bookworm-slim AS dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY . .
# SvelteKit's static public env is embedded in both server and browser bundles.
ARG PUBLIC_CONVEX_URL
ENV PUBLIC_CONVEX_URL=$PUBLIC_CONVEX_URL
RUN test -n "$PUBLIC_CONVEX_URL" || (echo 'PUBLIC_CONVEX_URL build argument is required' >&2; exit 1)
RUN bun run build

FROM dependencies AS production-dependencies
RUN rm -rf node_modules && bun install --frozen-lockfile --production --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
