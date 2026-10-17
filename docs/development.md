# Development

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Docker](https://www.docker.com/) (for PostgreSQL)

## Getting Started

```bash
# Install dependencies (also installs lefthook git hooks)
bun install

# Copy and configure environment
cp .env.example .env

# Start PostgreSQL
docker compose up db -d

# Run database migrations
bun db:migrate

# Copy the public card catalog, rules and prices from openrift.app (see "Card data")
bun db:sync

# Start all dev servers
bun dev
```

The frontend is available at `https://localhost:5173` (TanStack Start dev server with SSR). The certificate is self-signed, so the browser warns once. The API runs at `http://localhost:3000`. Server functions call the API directly at `localhost:3000`. Only `/api/auth/*` is proxied through the dev server (needed for OAuth redirects and cookie setting).

## Running Individual Apps

```bash
bun dev:web    # Vite dev server only (apps/web)
bun dev:api    # Hono API server only (apps/api)
bun dev        # All apps + shared type checking in parallel
bun dev:http   # Same as `bun dev`, but plain http (no self-signed cert)
bun dev:devtools  # Same as `bun dev`, plus the TanStack devtools and react-scan
```

The TanStack devtools are off by default: the Vite plugin and react-scan cost
about 3 seconds of every cold dev start. Use `bun dev:devtools` when you want
them.

`bun dev` serves the web app over HTTPS with a self-signed certificate, because
the card scanner's camera needs a secure context. It also sends the
cross-origin isolation headers (COOP/COEP) that unlock SharedArrayBuffer for
the scanner's multi-threaded WASM encoder. COEP blocks cross-origin
subresources that don't send CORP/CORS headers, so use `bun dev:http` for flows
that trip over that or over the self-signed cert (curl checks, e2e). The HTTPS
server negotiates HTTP/1.1 only: Firefox randomly fails module loads over
Node's HTTP/2 dev server (vitejs/vite#21569), which leaves the page stuck in
its server-rendered state.

## Card scanner

The scanner's engine files are not in the repository. Place the encoder and
the two detectors in `media/scan/` once, then name the detectors in `.env`:

```bash
SCAN_DETECTOR_FILE=scan-detector-v2.onnx
SCAN_BOARD_DETECTOR_FILE=scan-board-detector-v2.onnx
```

The encoder name defaults to `scan-encoder-v2.onnx`, and `SCAN_ENCODER_FILE`
changes it. Without the card detector the scan manifest reports the scanner as
unavailable. Without the board detector it scans single cards, and board reads, sweeps and the admin
straighten tool are off. Build the reference bank once from the admin scan
page after the encoder is in place. The offline bench under `scripts/scan/`
has its own setup, described in `scripts/scan/README.md`.

## Card data

A fresh database has no cards. `bun db:sync` copies the public data of the OpenRift instance in `CATALOG_SOURCE_URL` (openrift.app in `.env.example`) into the database in `DATABASE_URL`. Run it after `bun db:migrate`, and again whenever you want the latest cards, rules or prices.

What it copies:

- **Catalog** from `/api/v1/init` and `/api/v1/catalog`: sets, cards, printings, errata, bans, tokens, tags, custom tags, keywords, markers, distribution channels and image records. Card, set, printing and image ids match the source, so card links and deck codes work the same as on openrift.app.
- **Rules** from `/api/v1/rules/versions` and `/api/v1/rules`: every core and tournament version in every language.
- **Latest prices** from `/api/v1/prices` and `/api/v1/prices/marketplace-info`: one snapshot per marketplace product. There is no price history.

It does not copy users, decks, collections, lists, groups, tournaments, the meta archive, sealed products or image files. When a card image is missing from `./media`, the web dev server redirects the request to `CATALOG_SOURCE_URL`, so images load from the source.

**Updates.** Later runs update every copied row from the source. Local changes to cards, printings, tags, rules or prices are overwritten, for example edits made in the admin card editor. Rows the source no longer has stay in place, because user data may reference them. Users, decks, collections and lists are never touched.

**Confirmation.** Each run first prints the target database, the source, and whether this is a first sync or an update. It then asks you to type `yes`. For a database whose host is not `localhost`, `127.0.0.1` or `::1` it prints a warning and asks you to type the database name instead, and `--yes` does not skip that. Outside a terminal, a local run needs `--yes` and a non-local run refuses:

```bash
bun db:sync          # prints the plan, asks for "yes"
bun db:sync --yes    # local database only: skips the question
```

**Safety check.** The first sync records the source URL in the `site_settings` row `dev.catalog-sync-source`. If a database already has cards or rules but no such row, `db:sync` refuses to run. That protects a restored production dump or any catalog maintained through the admin tools, where an overwrite would replace curated data with the public subset. To sync such a database anyway, start from an empty one: drop it, migrate, then run `db:sync`.

Each part (catalog, rules, prices) is written in its own transaction. If a run fails partway, run it again: the earlier parts are already in place and are updated again.

## Database

PostgreSQL runs in Docker. Data persists in a bind mount at `./data/postgres` — to wipe it, stop the container and remove the directory: `docker compose down && rm -rf ./data/postgres`.

```bash
bun db:migrate    # Run pending migrations
bun db:rollback   # Roll back the last migration
bun db:sync       # Copy or update the public catalog, rules and prices (see "Card data")
bun make-admin -- <email>  # Grant admin role to a user
bun db:dev-sanitize        # Sanitize a restored production dump (local DB only)
```

`bun db:dev-sanitize` is meant for a database restored from a production dump: it sets one password for every account (`1111`, or a value passed as an argument), gives users who only signed up through Google, Discord, or an email code a password account so they can be signed in as too, marks every email verified, and clears every `job_schedules` row so the restored dump can't start production's jobs locally. It refuses to run unless `DATABASE_URL` points at localhost.

API keys authenticate script calls to the API: send the key as an `x-api-key` header and the request runs as the key's owner (same permissions, including admin). Keys are created on the `/admin/api-keys` page and shown once at creation.

Migrations live in `apps/api/src/db/migrations/` and must be registered in that directory's `index.ts` barrel. The `bun db:migrate` / `bun db:rollback` scripts wrap `scripts/run-migrations.ts`.

To open a psql shell against the local database:

```bash
docker exec -it openrift-db-1 psql -U openrift
```

For one-off queries without an interactive shell:

```bash
docker exec openrift-db-1 psql -U openrift -c "SELECT count(*) FROM cards;"
```

## Troubleshooting

**"Failed to load cards" in the browser**

| Cause                         | Fix                       |
| ----------------------------- | ------------------------- |
| Database not running          | `docker compose up db -d` |
| Migrations not applied        | `bun db:migrate`          |
| Database empty (no card data) | `bun db:sync`             |

## Linting and Formatting

```bash
bun lint          # Full lint: oxlint, then ESLint (React Compiler rules), then oxfmt
bun lint:oxlint   # Run oxlint with --fix
bun lint:oxfmt    # Run oxfmt on apps/ and packages/
```

[Lefthook](https://github.com/evilmartians/lefthook) runs pre-commit hooks automatically: TypeScript type checking, oxlint, ESLint (React Compiler rules), and oxfmt. Commit messages are validated by [commitlint](https://commitlint.js.org/) to enforce [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.).

## Environment Variables

See `.env.example` for all required variables:

| Variable                | Purpose                                | Dev default                                            |
| ----------------------- | -------------------------------------- | ------------------------------------------------------ |
| `POSTGRES_DB`           | Database name                          | `openrift`                                             |
| `POSTGRES_USER`         | Database user                          | `openrift`                                             |
| `POSTGRES_PASSWORD`     | Database password                      | `password` (change in production)                      |
| `DATABASE_URL`          | Full Postgres connection string        | `postgres://openrift:password@localhost:5432/openrift` |
| `DB_PORT`               | Host-side Postgres port                | `5432`                                                 |
| `API_PORT`              | Host-side API port                     | `3001`                                                 |
| `WEB_PORT`              | Host-side web port                     | `8080`                                                 |
| `IMAGE_TAG`             | GHCR image tag                         | `latest`                                               |
| `CORS_ORIGIN`           | Allowed CORS origins (comma-separated) | `https://openrift.app,https://preview.openrift.app`    |
| `BETTER_AUTH_SECRET`    | Auth secret key                        | _(generate with `openssl rand -base64 32`)_            |
| `BETTER_AUTH_URL`       | Auth base URL                          | `http://localhost:5173`                                |
| `SMTP_HOST`             | SMTP server for email verification     | `smtp.fastmail.com`                                    |
| `SMTP_PORT`             | SMTP port                              | `465`                                                  |
| `SMTP_SECURE`           | Use TLS for SMTP                       | `true`                                                 |
| `SMTP_USER`             | SMTP username                          | —                                                      |
| `SMTP_PASS`             | SMTP password                          | —                                                      |
| `SMTP_FROM`             | Sender address                         | `OpenRift <noreply@openrift.app>`                      |
| `GOOGLE_CLIENT_ID`      | Google OAuth client ID                 | —                                                      |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth client secret             | —                                                      |
| `DISCORD_CLIENT_ID`     | Discord OAuth client ID                | —                                                      |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret            | —                                                      |
