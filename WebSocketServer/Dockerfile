# ---- Build args for all stages ----
ARG BUILD_DIR=/build
ARG DEST_DIR=/app

# ---- Stage: Create uniform build environment ---------------------------------
FROM rust:1.96 AS build_base

# -- Nothing else to do, for now
# -- If any dependencies are added that need to be used by all build
# environments, install them here.

# ---- Stage: Build Test Runner ------------------------------------------------
FROM build_base AS test_runtime

ARG BUILD_DIR
ARG DEST_DIR

WORKDIR ${BUILD_DIR}

RUN mkdir -p ./src

# -- Build tests
RUN \
  --mount=type=bind,source=Cargo.toml,target=./Cargo.toml \
  --mount=type=bind,source=Cargo.lock,target=./Cargo.lock \
  --mount=type=bind,source=src/wss,target=./src/wss \
  --mount=type=cache,id=whiteboard_editor.wss.test_target,target=./target \
  <<_EOF_
#!/usr/bin/bash -ve

# Remove old test binaries
if [[ -d "./target/debug/deps" ]]
then
  find target/debug/deps -type f -name "*web_socket_server*" -delete
fi

# Build tests anew (dependency builds should be cached)
cargo test --no-run

# Copy artifacts to final destination
mkdir -p "${DEST_DIR}"
cp -p ./Cargo.toml ./Cargo.lock "${DEST_DIR}"
cp -rp ./src "${DEST_DIR}/src"
cp -rp ./target "${DEST_DIR}/target"
_EOF_

# -- Set up test runtime
WORKDIR ${DEST_DIR}

ENTRYPOINT ["cargo", "test"]

# ---- Stage: Build Release Binary ----
FROM build_base AS build_release

ARG BUILD_DIR
ARG DEST_DIR

WORKDIR ${BUILD_DIR}

# Build release binary
RUN \
  --mount=type=bind,source=Cargo.toml,target=./Cargo.toml \
  --mount=type=bind,source=Cargo.lock,target=./Cargo.lock \
  --mount=type=bind,source=src,target=./src \
  --mount=type=cache,id=whiteboard_editor.wss.release_target,target=${BUILD_DIR}/target \
  cargo build --release

# Copy final build from cache
WORKDIR ${DEST_DIR}

RUN \
  --mount=type=cache,id=whiteboard_editor.wss.release_target,target=${BUILD_DIR}/target \
  cp \
    --preserve=mode,timestamps \
    ${BUILD_DIR}/target/release/web_socket_server \
    ${DEST_DIR}/web_socket_server

# ---- Stage: Prepare Release Runtime Environment ----
FROM debian:trixie-slim AS release

ARG BUILD_DIR
ARG DEST_DIR

WORKDIR ${DEST_DIR}

RUN <<_EOF_
#!/usr/bin/bash -ve

apt-get update
apt-get install -y ca-certificates
rm -rf /var/lib/apt/lists/*
_EOF_

# Copy cached binary into final location
COPY --from=build_release ${DEST_DIR}/web_socket_server /usr/local/bin/web_socket_server

# Set working directory to destination
RUN useradd -m appuser
USER appuser

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/web_socket_server"]
