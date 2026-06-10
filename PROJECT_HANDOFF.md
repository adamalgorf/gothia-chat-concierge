# Project Handoff

This file captures the working context from the Codex session so the project can be continued from another machine.

## Repository

GitHub:

https://github.com/adamalgorf/gothia-chat-concierge

Current working branch:

```bash
codex/local-backend-clean-architecture
```

Latest important commits:

```txt
61a6b48 Add project README
9c9ff98 Require room or booking reference for check-in
570c5bd Clarify OpenAI quota configuration error
710d4cc Stop tracking local environment file
44e747e Clarify missing AI configuration errors
82e844c Serve client assets in Docker runtime
7bfd3c9 Prepare local Docker backend and clean architecture
```

## Current Status

The project has been converted into a local Dockerized fullstack setup.

It includes:

- React / TanStack Start app.
- Server routes and server functions in TypeScript.
- Local Supabase-compatible backend.
- Postgres database.
- PostgREST REST API.
- Nginx gateway for local Supabase-style access.
- OpenAI API integration through a backend route.
- A README with setup and troubleshooting instructions.

The app runs locally at:

```txt
http://localhost:3000
```

Internal staff view:

```txt
http://localhost:3000/internal
```

Guest room view:

```txt
http://localhost:3000/gastrum
```

Local Supabase REST gateway:

```txt
http://localhost:54321/rest/v1
```

Local Postgres:

```txt
localhost:54322
```

## How To Continue On Mac

Clone the repo:

```bash
git clone https://github.com/adamalgorf/gothia-chat-concierge.git
cd gothia-chat-concierge
git checkout codex/local-backend-clean-architecture
```

Create the local environment file:

```bash
cp .env.example .env
```

Edit `.env` and add:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.2
```

Start Docker:

```bash
docker compose up --build -d
```

Check containers:

```bash
docker compose ps
```

Open:

```txt
http://localhost:3000
```

## Important Security Note

The `.env` file is intentionally not committed to GitHub.

Reason:

- It contains secrets such as `OPENAI_API_KEY`.
- Secrets should stay local or be stored in a proper secret manager.

The Mac needs its own `.env` file created from `.env.example`.

## Main Decisions Made

### Use Supabase-compatible local backend

The backend stack uses:

- Postgres
- PostgREST
- Nginx gateway
- Supabase JS client

This gives the app local database functionality without depending on hosted Supabase during development.

### Keep backend in TypeScript for now

The backend is currently written through TanStack Start server routes and server functions.

Reason:

- The app already uses TanStack Start.
- Server functions and frontend can share TypeScript types and modules.
- It keeps the local Docker setup smaller.
- A Python/FastAPI backend can still be added later if the backend grows.

### Keep OpenAI server-side

The browser calls:

```txt
POST /api/chat
```

The server route calls OpenAI.

This prevents the OpenAI API key from being exposed in the browser.

### Use Docker as the main runtime

Docker is the recommended way to run the project.

Reason:

- Same setup on Windows and Mac.
- App, database, REST API, and gateway run together.
- Easier local demo and onboarding.

## Product Flows Tested

### Start Page

Main actions:

- Checka in
- Boka rum
- Checka ut

### Check-in

Current requirement:

The user must enter either:

- A room number, for example `1204`
- A booking number, for example `GT-12345`

Plain last names such as `Andersson` are not accepted.

Relevant files:

```txt
src/lib/check-in/check-in-flow.ts
src/components/CheckIn.tsx
```

### Booking

The booking flow now shows before card details:

- Arrival date
- Departure date
- Number of guests
- Number of rooms
- Room type
- Breakfast option
- Room subtotal
- Breakfast subtotal
- Total price

Relevant files:

```txt
src/lib/booking/booking-pricing.ts
src/components/CheckIn.tsx
```

### Check-out

Check-out requires a valid room number.

Empty room number is rejected.

### AI Concierge

The AI concierge works when:

- `OPENAI_API_KEY` is set in `.env`
- OpenAI Platform billing is enabled
- The account has available quota

Important clarification:

ChatGPT Plus is not the same as OpenAI Platform API billing.

## Verification Already Done

Docker build passed:

```bash
docker compose up --build -d
```

App routes returned HTTP 200:

```txt
http://localhost:3000
http://localhost:3000/internal
http://localhost:3000/gastrum
```

AI chat returned a streaming 200 response after OpenAI billing was topped up.

Check-in validation was tested directly:

```txt
Andersson -> rejected
1204 -> accepted
GT-12345 -> accepted
```

Supabase REST was verified with the service role key from the app container.

## Useful Commands

Start:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Reset local database:

```bash
docker compose down -v
docker compose up --build -d
```

Logs:

```bash
docker compose logs app
docker compose logs -f app
```

Git status:

```bash
git status -sb
```

Pull latest branch:

```bash
git fetch
git checkout codex/local-backend-clean-architecture
git pull
```

## Interview Talking Points

Short project pitch:

```txt
This is a local fullstack hotel concierge app for check-in, room booking, check-out, and AI concierge chat. I dockerized the project with a local Supabase-compatible backend, moved AI calls behind a server-side route, kept secrets out of the browser, and refactored business logic into dedicated modules for cleaner architecture.
```

Strong technical points:

- Dockerized local fullstack environment.
- Local Postgres and PostgREST instead of remote-only backend.
- OpenAI key is server-side only.
- Business logic is separated from UI where practical.
- Booking UX shows price before card details.
- Check-in validation now matches the product requirement.
- `.env` is ignored and not committed.

Honest production-readiness note:

```txt
This is a local MVP/demo architecture. Before production I would add real authentication, protect internal routes, add CI/CD, automated tests, rate limiting, monitoring, and production-grade secrets management.
```

## Next Good Improvements

- Add automated tests with Vitest or Playwright.
- Protect `/internal` with authentication.
- Add rate limiting to `/api/chat`.
- Add CI build checks in GitHub Actions.
- Add a production deployment plan.
- Consider Python/FastAPI only if backend domain logic grows enough to justify a separate service.

