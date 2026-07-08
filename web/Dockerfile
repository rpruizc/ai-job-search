FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates && rm -rf /var/lib/apt/lists/*

# Install Bun (for scraper CLIs)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# ---- Install scraper CLI dependencies ----
FROM base AS scrapers
WORKDIR /scrapers
COPY .agents/skills/ ./skills/
RUN for dir in skills/*/cli; do \
      if [ -d "$dir" ]; then \
        cd /scrapers/$dir && bun install --frozen-lockfile 2>/dev/null || bun install; \
        cd /scrapers; \
      fi; \
    done

# ---- Install Next.js dependencies ----
FROM base AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm ci

# ---- Build Next.js application ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
RUN npm run build

# ---- Production runtime ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /root/.bun/bin/bun /usr/local/bin/bun

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/db ./db

# Scraper CLIs (Bun-based)
COPY --from=scrapers /scrapers/skills ./.agents/skills

# Skill files for system prompt
COPY .claude/skills/ ./.claude/skills/

# Persistent data volume mount point
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

ENV DATABASE_PATH=/data/app.db
ENV REPO_ROOT=/app
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", "server.js"]
