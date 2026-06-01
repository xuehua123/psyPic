ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

ARG APT_MIRROR=
RUN if [ -n "$APT_MIRROR" ]; then \
    sed -i \
      -e "s|http://deb.debian.org/debian-security|${APT_MIRROR}/debian-security|g" \
      -e "s|http://deb.debian.org/debian|${APT_MIRROR}/debian|g" \
      /etc/apt/sources.list.d/debian.sources; \
  fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "exec", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
