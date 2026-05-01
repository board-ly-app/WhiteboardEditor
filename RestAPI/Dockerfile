# Global build args
ARG BUILD_DIR=/build
ARG DEST_DIR=/app

# ---- Stage: Builder (and tester) ----
FROM node:24-alpine3.21 AS builder

ARG BUILD_DIR
ARG DEST_DIR

# Create new working directory
WORKDIR ${BUILD_DIR}

# Copy source files
COPY . .

# Install dependencies and build.
# Cache node_modules for future builds.
# Then, copy to /app directory for persistence, to allow in-image testing.
RUN \
  --mount=type=cache,id=yarn_home,target=${HOME}/.yarn \
  --mount=type=cache,id=node_modules,target=${BUILD_DIR}/node_modules \
  yarn install --prefer-offline && \
  npx tsc && \
  cp -rp . ${DEST_DIR}

# Set up testers to run from ${DEST_DIR}
WORKDIR ${DEST_DIR}

ENTRYPOINT ["yarn", "test"]

# ---- Stage: Release Build Runner ----
FROM node:24-alpine3.21 AS release

ARG DEST_DIR

# Run from /app
WORKDIR ${DEST_DIR}

# Copy build files to destination
COPY --from=builder ${DEST_DIR}/dist ./dist

# Copy node_modules from cache
RUN \
  --mount=type=cache,id=node_modules,target=${DEST_DIR}/node_modules_cache \
  cp -rp ./node_modules_cache ./node_modules

# Run app
EXPOSE 3000
ENTRYPOINT ["node", "dist/src/main.js"]
