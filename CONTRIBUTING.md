# Contributing to OpenRift

## Getting Started

You need [Bun](https://bun.sh/) and [Docker](https://www.docker.com/).

1. Fork the repo and clone it
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET` (generate one with `openssl rand -base64 32`). The other defaults work for local development.
4. Start PostgreSQL: `docker compose up db -d`
5. Create the schema: `bun db:migrate`
6. Load the card data: `bun db:sync`, then type `yes`. This copies the public cards, rules and prices from openrift.app into your local database. Card images load from openrift.app. Run it again later to update. That overwrites local changes to card data but never touches your users, decks or collections.
7. Start developing: `bun dev`, then open `https://localhost:5173`. Without SMTP settings, sign-in codes and other emails are printed in the API log.

`docs/development.md` has the details and a troubleshooting table.

## Finding your way around

- `apps/web` is the website (React, TanStack Start, Tailwind). Most UI changes only touch `apps/web/src/features/<area>/`, for example `features/decks/components/` for the deck builder.
- `apps/api` is the API server and `packages/shared` holds types and logic both use. A UI change rarely needs either.
- Read `docs/contributing.md` for code conventions and `docs/ui-composition.md` before building a new page or toolbar. The deployment, migration and API docs can wait until you need them.

## Submitting Changes

1. Create a branch from `main`
2. Make your changes
3. Run `bun lint` before committing
4. Open a pull request

For bigger changes, ask on [Discord](https://discord.gg/Qb6RcjXq6z) first so we can agree on the direction.

## Contributor License Agreement

By submitting a pull request, you agree to the terms of our [CLA](CLA.md).
