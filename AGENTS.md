# AGENTS.md

ST Hiring: events and tickets (See Tickets hiring assessment). A Yarn 4 + Turborepo monorepo with an Express API, a React SPA and a shared contracts package. See `README.md` for setup, QA commands and benchmarks.

## Layout

```
.
├── apps/
│   ├── backend/        # @st-hiring/backend  (git submodule, st-hiring-backend)
│   └── frontend/       # @st-hiring/frontend (git submodule, st-hiring-frontend)
├── packages/
│   └── shared/         # @st-hiring/shared: domain types, Yup schemas, endpoint contracts, errors
├── flake.nix           # Nix devshell + commands (run, migrate, seed, lint, format, sast, sca, zap…)
├── turbo.json          # build / dev / lint / test / test:coverage pipelines (all depend on ^build)
├── vitest.workspace.ts # merged coverage across workspaces
└── sonar-project.properties
```

`apps/*` are submodules: commit inside the submodule first, then bump the pointer in the root repo.

## Constraints

- Node 22, Yarn 4 (Corepack). Never use npm.
- Events and tickets live in PostgreSQL; settings live in MongoDB.
- Frontend must use MUI, Redux Toolkit, Formik + Yup.
- Every new or changed module needs unit tests (coverage is ~100%; keep it there).
- Pinned stack versions from each app's README must not change (Express 4.19.2, React 18, Vite 5, etc.).
- Follow the existing patterns below.

## Shared (`packages/shared`)

Single source of truth for both apps; built with `tsup` (ESM + CJS).

- `domain/entities`: `Event`, `Ticket`, `Setting` (`{ id, value, version, createdAt, updatedAt }`).
- `domain/interfaces`: `EventsRepository`, `SettingsRepository`. Backend implements them.
- `domain/errors`: `ApplicationError` hierarchy (client/server errors), serialized in failure responses.
- `domain/types`: `Response<T>` envelope (`{ isSuccess: true, body }` / `{ isSuccess: false, error }`), HTTP helpers, `TRANSACTION_ID_HEADER`.
- `schemas`: Yup entity schemas, request/response DTOs and endpoint contracts made with `defineContract({ method, path, request, response })`.

Current contracts:

| Contract | Method | Path |
|---|---|---|
| `GetPaginatedEventsEndpoint` | GET | `/v1/events?page=&pageSize=` |
| `GetSettingsEndpoint` | GET | `/v1/settings` |
| `UpsertSettingEndpoint` | PUT | `/v1/settings/:id` (no `version` creates, with `version` updates with optimistic locking) |

To add an endpoint: define DTO schemas and a contract in `shared`, then serve it with `createRoute` in the backend and call it with `callEndpoint` in the frontend.

## Backend (`apps/backend`)

Express 4, Knex + pg, MongoDB driver, helmet, OpenTelemetry (traces to Jaeger). Layered, with factory functions and manual DI:

```
src/
├── index.ts                    # composition root: knex, MongoClient, repositories, use cases, middleware, listen(3000)
├── tracing.ts                  # OpenTelemetry SDK (http, express, pg, mongodb)
├── knexfile.ts
├── application/usecases/       # createXxxUseCase({ repository }) → async fn; createUseCases() wires them
├── dal/                        # createEventsRepository(knex), createSettingsRepository(db)
├── routes/
│   ├── create-route.ts         # createRoute(contract, handler): validation + typed req/res + error forwarding
│   └── v1/                     # events.routes.ts, settings.routes.ts, index.ts (createV1Router)
├── middleware/                 # transaction-id, validate-request, not-found-handler, error-handler
└── database/
    ├── migrations/*.js         # events, tickets, price split (face_value/service_fee), ticket_status enum, text description
    ├── seeds/                  # postgres events + tickets
    └── mongo-seeds/            # settings
```

- Request pipeline: helmet → cors (`CORS_ORIGINS`) → `/health` → `requireTransactionId` (`X-Transaction-Id`) → json → v1 router → 404 → error handler.
- Handlers respond with `createSuccessResponse(...)`; thrown `ApplicationError`s become failure envelopes in `errorHandler`.
- Tests sit next to the source (`*.test.ts`, Vitest). Style: Prettier with single quotes, semicolons, `printWidth: 120`.
- Scripts: `dev`, `test`, `test:coverage`, `lint`, `migrations:latest|down|make`, `db:seed`, `db:seed:mongo`, `db:seed:all`.
- Env (`apps/backend/.env`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MONGO_URI`, `MONGO_DB`, `CORS_ORIGINS`, `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `docker-compose.yml` runs postgres, mongo, jaeger, adminer, mongo-express and sonarqube.

## Frontend (`apps/frontend`)

React 18, Vite 5, MUI 5, Redux Toolkit, TanStack Query, Formik + Yup, Storybook 10, MSW.

```
src/
├── main.tsx            # Provider(store) → QueryClientProvider → ThemeProvider + CssBaseline → App
├── App.tsx             # OrderLimitBanner + SettingsDialog + EventsList
├── theme.ts, format.ts
├── api/                # callEndpoint(contract, input): validates request and response against shared schemas
│   └── query/          # query client, query keys, retry policy
├── hooks/              # usePaginatedEvents, useSettings, useUpsertSetting (TanStack Query)
├── store/              # eventsPagination and settings slices, settings sync/persistence (localStorage)
├── forms/              # Formik wrappers: Form, FormActions, FormStatus, fields/FormTextField|FormSelect|FormSwitch
├── components/         # atomic design: atoms/, molecules/, organisms/ (each folder: Component, stories, test, index)
└── test/               # render helpers, MSW server + handlers, fixtures, story runner
```

- Server state goes in TanStack Query; UI state (pagination, settings mirror) goes in Redux.
- `*Container` components connect hooks to presentational components.
- Story `play` functions also run as Vitest tests (`*.stories.test.tsx`).
- Vite proxies `/v1` to `http://localhost:3000`; `VITE_API_URL` overrides the base URL. `@st-hiring/shared` is aliased to its source.
- Style: Prettier without semicolons; use MUI for all UI.

## Commands

From the root: `yarn dev`, `yarn build`, `yarn lint`, `yarn test`, `yarn coverage` (merged report in `coverage/`), `yarn format[:check]`, `yarn sonar`.
In the Nix devshell: `run`, `migrate`, `seed`, `lint`, `format`, `storybook`, `sast`, `sast-analyze`, `sca`, `zap` (`app-help` lists them all).

Services: frontend :5173, API :3000/v1, Jaeger :16686, Adminer :8080, mongo-express :8081, Storybook :6006, SonarQube :9000.

## Proposed: API documentation (not implemented)

Generate OpenAPI 3.1 from the shared Yup contracts (`@sodaru/yup-to-json-schema`, isolated behind a single backend `toJsonSchema()` wrapper). Serve Redoc at `/docs` and the spec at `/openapi.json`, before the 404 handler. Verify it with a `redocly lint` test. Keep Yup and skip decorator frameworks.
