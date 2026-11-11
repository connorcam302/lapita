FROM oven/bun:1.3.4 AS bun

FROM node:22-bookworm-slim AS dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY . .

ARG PUBLIC_CONVEX_URL
ARG CONVEX_SELF_HOSTED_URL
ARG CONVEX_DEPLOY_REVISION=0

ENV PUBLIC_CONVEX_URL=$PUBLIC_CONVEX_URL

RUN test -n "$PUBLIC_CONVEX_URL" && bun run build

RUN --mount=type=secret,id=CONVEX_SELF_HOSTED_ADMIN_KEY \
    test -n "$CONVEX_SELF_HOSTED_URL" && \
    test -s /run/secrets/CONVEX_SELF_HOSTED_ADMIN_KEY && \
    : "$CONVEX_DEPLOY_REVISION" && \
    CONVEX_SELF_HOSTED_ADMIN_KEY="$(cat /run/secrets/CONVEX_SELF_HOSTED_ADMIN_KEY)" \
    ./node_modules/.bin/convex deploy

# Install production dependencies only
FROM dependencies AS production-dependencies
RUN rm -rf node_modules && \
    bun install --frozen-lockfile --production --ignore-scripts

# Final application image
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

CMD ["node", "build"]
