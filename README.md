# Gothia Chat Concierge

Local fullstack hotel concierge app for Gothia Towers. The app supports guest check-in, room booking, check-out, an AI concierge chat, and an internal staff view.

The project is designed to run locally with Docker Desktop. It includes the application server, a local Postgres database, PostgREST, and a small Supabase-compatible gateway.

## Features

- Guest check-in with room number or booking number.
- Room booking flow with dates, guest count, room count, room type, breakfast, and total price before card details.
- Guest check-out by room number.
- AI concierge chat through a backend endpoint.
- Internal hotel staff view.
- Local Supabase-compatible backend with Postgres and REST access.
- Dockerized local development and demo environment.

## Tech Stack

- React 19
- TanStack Start, Router, and Query
- TypeScript
- Tailwind CSS
- Bun
- Docker Compose
- Postgres
- PostgREST
- Nginx gateway
- Supabase JS client
- OpenAI API through the Vercel AI SDK

## Architecture

```txt
Browser
  -> React / TanStack Start app on localhost:3000
  -> Server routes and server functions
  -> Local Supabase-compatible gateway on localhost:54321
  -> PostgREST
  -> Postgres

AI chat:
Browser -> /api/chat -> server-side OpenAI API call
```

The OpenAI API key is only used server-side. It should be stored in `.env` and must not be committed.

## Requirements

- Docker Desktop
- Git
- An OpenAI Platform API key if you want the AI concierge to answer

Bun is not required when running with Docker because the app image installs dependencies inside the container.

## Quick Start

Clone the repository:

```bash
git clone https://github.com/adamalgorf/gothia-chat-concierge.git
cd gothia-chat-concierge
git checkout codex/local-backend-clean-architecture
```

Create a local environment file:

```bash
cp .env.example .env
```

Add your OpenAI API key to `.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.2
```

Start the local stack:

```bash
docker compose up --build -d
```

Open the app:

- App: http://localhost:3000
- Internal view: http://localhost:3000/internal
- Guest room view: http://localhost:3000/gastrum
- Local Supabase REST gateway: http://localhost:54321/rest/v1
- Local Postgres: localhost:54322

## Docker Services

The local stack contains:

| Service | Purpose | Port |
| --- | --- | --- |
| `app` | Built TanStack Start app and backend routes | `3000` |
| `supabase-db` | Local Postgres database | `54322` |
| `rest` | PostgREST API over Postgres | internal |
| `supabase-gateway` | Local Supabase-style HTTP gateway | `54321` |

Useful commands:

```bash
docker compose ps
docker compose logs app
docker compose logs -f app
docker compose down
```

Reset local database data and rerun migrations:

```bash
docker compose down -v
docker compose up --build -d
```

## Environment Variables

Main variables from `.env.example`:

| Variable | Description |
| --- | --- |
| `APP_PORT` | Local app port, default `3000` |
| `OPENAI_API_KEY` | OpenAI Platform API key |
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL |
| `OPENAI_MODEL` | Model used by the AI concierge |
| `SUPABASE_PORT` | Local Supabase gateway port |
| `LOCAL_SUPABASE_PUBLIC_URL` | Browser-facing Supabase gateway URL |
| `POSTGRES_PORT` | Local Postgres port |
| `LOCAL_POSTGRES_PASSWORD` | Local Postgres password |
| `LOCAL_JWT_SECRET` | Local JWT secret for PostgREST |
| `LOCAL_SUPABASE_PUBLISHABLE_KEY` | Local anon/publishable JWT |
| `LOCAL_SUPABASE_SERVICE_ROLE_KEY` | Local service-role JWT |

The `LOCAL_*` Supabase values are intended for local development only. Replace them before using this architecture outside local development.

## Important Flows

### Check-in

Check-in requires either:

- A room number, for example `1204`
- A booking number, for example `GT-12345`

Plain last names are not accepted as check-in identifiers.

Core logic:

- `src/lib/check-in/check-in-flow.ts`
- `src/components/CheckIn.tsx`

### Booking

The booking flow shows the guest:

- Check-in date
- Check-out date
- Number of guests
- Number of rooms
- Room type
- Breakfast option
- Room subtotal
- Breakfast subtotal
- Total price

Card details are requested only after the guest has seen the booking summary and total price.

Core logic:

- `src/lib/booking/booking-pricing.ts`
- `src/components/CheckIn.tsx`

### AI Concierge

The browser sends chat messages to:

```txt
POST /api/chat
```

The server route calls OpenAI using `OPENAI_API_KEY`. This keeps the API key out of the browser.

Core logic:

- `src/routes/api/chat.ts`
- `src/components/GuestChat.tsx`
- `src/lib/chat/`

## Local API Notes

If another local tool such as n8n runs outside Docker, it can call the app at:

```txt
http://localhost:3000
```

If the tool runs inside Docker, use:

```txt
http://host.docker.internal:3000
```

For local Supabase REST from inside Docker:

```txt
http://host.docker.internal:54321/rest/v1
```

## Development Without Docker

The recommended workflow is Docker. If you want to run the frontend locally without Docker, install Bun first and then run:

```bash
bun install
bun run dev
```

You still need a database and the expected environment variables for full backend functionality.

## Testing Checklist

After starting Docker, verify:

```bash
docker compose ps
```

Then open:

- http://localhost:3000
- http://localhost:3000/internal
- http://localhost:3000/gastrum

Manual flow checks:

- Check-in rejects an empty identifier.
- Check-in rejects a plain last name.
- Check-in accepts `1204`.
- Check-in accepts `GT-12345`.
- Booking shows room count and total price before card fields.
- Check-out rejects an empty room number.
- AI chat responds when `OPENAI_API_KEY` has valid billing and quota.

## Troubleshooting

### The app is not reachable

Check containers:

```bash
docker compose ps
docker compose logs app
```

Make sure port `3000` is not already used by another app.

### AI concierge cannot answer

Check `.env`:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.2
```

Also verify that the OpenAI Platform account has billing enabled and available quota. ChatGPT Plus is separate from OpenAI Platform API billing.

Restart after editing `.env`:

```bash
docker compose up --build -d
```

### Database changes are not applied

Migrations run when the Postgres volume is first created. Reset the volume:

```bash
docker compose down -v
docker compose up --build -d
```

### Supabase REST returns 401

Use the local publishable or service-role key configured in `.env.example`. The service role key is for server-side/local tooling only and should not be exposed in a public client.

## Production Readiness Notes

This is a local MVP/demo architecture. Before production, add:

- Real authentication and authorization.
- Protected internal staff routes.
- Proper secrets management.
- CI/CD.
- Automated tests.
- Rate limiting for `/api/chat`.
- Monitoring and structured logs.
- Production Supabase or managed Postgres deployment.

## Repository

GitHub:

https://github.com/adamalgorf/gothia-chat-concierge

