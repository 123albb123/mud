# syntax=docker/dockerfile:1

ARG DEBIAN_VERSION=12-slim

# Build FluffOS from the exact source revision used by the current runtime.
FROM debian:${DEBIAN_VERSION} AS fluffos-build

ARG FLUFFOS_REPOSITORY=https://github.com/fluffos/fluffos.git
ARG FLUFFOS_COMMIT=de945701234d348e3dd3e7aee59bf9e06e58539b

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        ca-certificates \
        git \
        build-essential \
        cmake \
        ninja-build \
        pkg-config \
        bison \
        flex \
        libffi-dev \
        libicu-dev \
        libpcre3-dev \
        libsqlite3-dev \
        libssl-dev \
        libjemalloc-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

RUN git init /src/fluffos \
    && git -C /src/fluffos remote add origin "${FLUFFOS_REPOSITORY}" \
    && git -C /src/fluffos fetch --depth 1 origin "${FLUFFOS_COMMIT}" \
    && git -C /src/fluffos checkout --detach "${FLUFFOS_COMMIT}"

# Match the project's known-good database choices while disabling CPU-specific
# instructions so an amd64 image can run on ordinary NAS hardware.
RUN cmake -S /src/fluffos -B /src/fluffos/build -G Ninja \
        -DCMAKE_BUILD_TYPE=Release \
        -DMARCH_NATIVE=OFF \
        -DUSE_JEMALLOC=ON \
        -DPACKAGE_DB_MYSQL:STRING= \
        -DPACKAGE_DB_POSTGRESQL:STRING= \
        -DPACKAGE_DB_SQLITE:STRING=2 \
        -DPACKAGE_DB_DEFAULT_DB:STRING=2 \
    && cmake --build /src/fluffos/build --target driver --parallel


# Runtime image: no compiler, CMake, Git, Node.js, or FluffOS source tree.
FROM debian:${DEBIAN_VERSION} AS runtime

LABEL org.opencontainers.image.source="https://github.com/123albb123/mud" \
      org.opencontainers.image.description="Yanhuang MUD with FluffOS and the modern web client"

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=Asia/Shanghai

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        ca-certificates \
        curl \
        gosu \
        libffi8 \
        libicu72 \
        libjemalloc2 \
        libpcre3 \
        libsqlite3-0 \
        libssl3 \
        python3-minimal \
        tzdata \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 mud \
    && useradd --system --uid 10001 --gid mud \
        --home-dir /mud --no-create-home --shell /usr/sbin/nologin mud

WORKDIR /mud

# Only the mudlib and already-built web assets are copied into production.
# Build tools, local binaries, source web files, logs, and runtime data stay
# out of the image.
COPY --chown=mud:mud adm /mud/adm
COPY --chown=mud:mud b /mud/b
COPY --chown=mud:mud clone /mud/clone
COPY --chown=mud:mud cmds /mud/cmds
COPY --chown=mud:mud d /mud/d
COPY --chown=mud:mud feature /mud/feature
COPY --chown=mud:mud help /mud/help
COPY --chown=mud:mud include /mud/include
COPY --chown=mud:mud inherit /mud/inherit
COPY --chown=mud:mud kungfu /mud/kungfu
COPY --chown=mud:mud mudcore /mud/mudcore
COPY --chown=mud:mud shadow /mud/shadow
COPY --chown=mud:mud std /mud/std
COPY --chown=mud:mud u /mud/u
COPY --chown=mud:mud world /mud/world
COPY --chown=mud:mud www /mud/www
COPY --chown=mud:mud config.ini /mud/config.ini

# These files are immutable image seeds. The entrypoint copies them into a
# newly-mounted data directory only when the corresponding target is absent.
COPY --chown=mud:mud data/.env.example /opt/yanhuang-seed/data/.env.example
COPY --chown=mud:mud data/e2c_dict.o /opt/yanhuang-seed/data/e2c_dict.o
COPY --chown=mud:mud data/emoted.o /opt/yanhuang-seed/data/emoted.o

COPY docker/entrypoint.sh /usr/local/bin/yanhuang-entrypoint
COPY --from=fluffos-build /src/fluffos/build/src/driver /usr/local/bin/driver

RUN mkdir -p /mud/data /mud/log /mud/backup /mud/dump /mud/temp \
        /opt/yanhuang-seed/data \
    && chmod 0755 /usr/local/bin/driver /usr/local/bin/yanhuang-entrypoint \
    && chown root:root /usr/local/bin/driver /usr/local/bin/yanhuang-entrypoint \
    && chown -R mud:mud /mud /opt/yanhuang-seed

EXPOSE 5566
EXPOSE 6666
EXPOSE 8888

# FluffOS handles SIGHUP through its orderly shutdown path. SIGTERM is
# reserved by this driver revision for its fatal-signal handler.
STOPSIGNAL SIGHUP

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5 \
    CMD curl -fsS --max-time 5 http://127.0.0.1:8888/app/index.html > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/yanhuang-entrypoint"]
CMD ["/usr/local/bin/driver", "config.ini"]
