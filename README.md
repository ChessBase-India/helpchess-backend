# Backend Template

An Express + Mongoose API service template with batteries included:

- **Layered structure** — `routes -> controllers -> services -> models`
- **Auth middlewares** — static-token auth, JWT cookie auth (required/optional), internal-user auth
- **Role/permission based authorization** — `authorizeInternalAccess` backed by a `users` collection
- **Structured logging** — winston with per-request correlation IDs (via CLS), daily-rotated files in deployed environments
- **Consistent responses** — `res.success` / `res.invalid` / `res.failure` / `res.unauthorized` / `res.forbidden` helpers
- **Config management** — [`config`](https://www.npmjs.com/package/config) with per-environment files and env-var overrides, `.env` validated by `dotenv-safe`
- **SQS worker scaffolding** — an example consumer entrypoint and producer util
- **Tooling** — eslint (airbnb-base + prettier), husky + lint-staged pre-commit, nodemon

## Getting started

### 1. Install dependencies

```console
npm i
```

### 2. Create your local `.env`

```console
cp .env.example .env
```

Important values:

```bash
PORT=3000
NODE_ENV=development
SERVICE_NAME=my-service
TIMEZONE=Asia/Kolkata
MONGO_URL=<mongodb_conn_string>
ACCESS_TOKEN=<any_random_string>
ACCESS_JWT_SECRET=<any_random_string>
REFRESH_JWT_SECRET=<any_random_string>
```

`dotenv-safe` requires every key in `.env.example` to exist in `.env` — dummy values are fine for anything you don't use (e.g. the SQS variables).

### 3. Run the dev server

```console
npm run dev
```

Verify: `curl http://localhost:3000/healthz`

## Project structure

```
src/
├── server.js                 # Express app entrypoint
├── routes.js                 # All route definitions
├── exampleEventsConsumer.js  # SQS worker entrypoint (npm run consumer)
├── controllers/              # Request validation + response shaping
├── services/                 # Business logic, returns { ok, data | msg }
├── models/                   # Mongoose schemas + data access
│   └── db.js                 # Mongo connection (required once at startup)
├── middlewares/
│   ├── auth.js               # Auth + role-based authorization middlewares
│   ├── clsify.js             # CLS namespace per request
│   ├── correlationIdBinder.js# Correlation id per request (in every log line)
│   └── response.js           # res.success / res.invalid / ... helpers
└── utils/                    # logger, cls, cors, sqs, helpers
config/
├── default.json              # Base config (committed, no secrets)
├── development|stage|production.json
└── custom-environment-variables.json  # Maps env vars -> config keys
```

Modules are imported root-relative from `src` (e.g. `require('services/notes')`) via `app-module-path`.

## Conventions

Every API response has the shape `{ ok, err, data }`. Controllers validate input and translate service results into responses; services contain business logic and always return `{ ok: true, data }` or `{ ok: false, msg }` instead of throwing; models own the Mongoose schema and all query logic.

The `notes` resource (`src/{controllers,services,models}/notes.js` + `src/routes.js`) is a working example of the full pattern, including how each auth middleware is applied. To add a resource, copy the three `notes` files, rename, and register routes in `src/routes.js`. Delete the notes files once you have real resources.

## Auth middlewares (`src/middlewares/auth.js`)

| Middleware | Use case |
|---|---|
| `authenticate` | Service-to-service auth: compares the `Authorization` header against the static `accessToken` config. |
| `authenticateByCookie` | End-user auth via a JWT in the cookie named by `cookies.refreshToken` config. Sets `req.userId`. |
| `authenticateByCookieOptional` | Same, but the request proceeds without `req.userId` if not logged in. |
| `authenticateByCookieInternal` | Back-office user auth via the cookie named by `cookies.internalJwt` config. Sets `req.userId`. |
| `authorizeInternalAccess(permissions)` | Role/permission check for internal users. Accepts a permission string or array (any-of). Users with `admin: true` bypass all checks. Sets `req.userPermissions` and `req.isAdmin`. |

Role-based access is backed by the `users` collection (`src/models/users.js`): each user has an `admin` flag and a `permissions` array. Define the available permissions in `config/default.json` under `internalAccess.permissions`.

The template intentionally ships **no login/signup routes** — issue the JWTs (signed with `refreshJwtSecret`, payload `{ userId }`) from your own auth flow and set them as cookies.

## SQS worker

`src/exampleEventsConsumer.js` is a standalone entrypoint that long-polls the queue configured under `exampleQueue` and hands messages to `services/exampleEvents.js`. Run it with `npm run consumer`. Use `utils/sqs.js` to publish messages. AWS credentials are picked up by the SDK from the standard `AWS_*` env vars.

## Config

Base values live in `config/default.json`, per-environment overrides in `config/<NODE_ENV>.json`, and secrets come from env vars mapped in `config/custom-environment-variables.json`. Never commit secrets; add new env vars to `.env.example` as documentation.

## Logging

Use `utils/logger` (never `console.log`). In `development` logs go to stdout; in `stage`/`production` they rotate daily under `logDir`. Every log line carries the request's correlation id, so a single request can be traced across log lines.
