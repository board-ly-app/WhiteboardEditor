# ---- Stage 1: Install dependencies and build ----
FROM node:24 AS builder

WORKDIR /app

# Copy source files
COPY . .

# Install dependencies and build.
# Cache node_modules for future builds.
RUN \
  --mount=type=cache,id=npm_home,target=${HOME}/.npm \
  --mount=type=cache,id=node_modules,target=/app/node_modules \
  npm install --prefer-offline && \
  npm ci && \
  npm run build

# ---- Stage 2: Serve with a static web server ----
FROM nginx:stable-alpine AS release

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf

# Run start script
CMD ["nginx", "-g", "daemon off;"]
