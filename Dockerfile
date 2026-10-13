# syntax=docker/dockerfile:1.7
# Multi-stage build: compile the static bundle with Node, serve it with an unprivileged nginx.
# The runtime image contains no Node, no source and no package manager.

ARG NODE_IMAGE=node:22.22-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# VITE_* values are compiled into the bundle at build time (see docs/DEPLOYMENT.md).
ARG VITE_API_MODE=mock
ARG VITE_API_BASE_URL=/api
ARG VITE_DEMO_LOCAL_PERSISTENCE=true
ENV VITE_API_MODE=${VITE_API_MODE} VITE_API_BASE_URL=${VITE_API_BASE_URL} VITE_DEMO_LOCAL_PERSISTENCE=${VITE_DEMO_LOCAL_PERSISTENCE}
# Hidden source maps are kept for error-tracking upload, never served: move them out of dist/.
RUN pnpm build \
 && mkdir -p /sourcemaps && find dist -name '*.map' -exec mv {} /sourcemaps/ \;

FROM ${NGINX_IMAGE} AS runtime
# nginx-unprivileged runs as uid 101 and listens on 8080; OpenShift may also assign an arbitrary uid,
# so everything nginx writes lives in /tmp (see nginx.conf) and files are group-readable.
COPY deploy/nginx/default.conf deploy/nginx/security-headers.inc /etc/nginx/conf.d/
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
