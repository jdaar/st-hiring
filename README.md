# ST Hiring — Events & Tickets

Yarn 4 + Turborepo monorepo:

| Workspace | Path | Stack |
|---|---|---|
| `@st-hiring/backend` | `apps/backend` (submodule) | Express 4, Knex/PostgreSQL, MongoDB, OpenTelemetry |
| `@st-hiring/frontend` | `apps/frontend` (submodule) | React 18, Vite, MUI, Redux Toolkit, TanStack Query, Formik + Yup, Storybook |
| `@st-hiring/shared` | `packages/shared` | Domain types, Yup schemas, `Response<T>`, `ApplicationError` ADT |

## Execution

```bash
git clone --recurse-submodules <repo> && cd st-hiring
```

Backend environment, `apps/backend/.env`:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USER=root
DB_PASSWORD=example
DB_NAME=seetickets
MONGO_URI=mongodb://root:example@localhost:27017
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### With Nix

The flake provides Node 22, Yarn, Turbo, Podman/docker-compose, Sonar and ZAP. Run `app-help` to list every command.

```bash
nix develop        # devshell
yarn install
run                # containers + `turbo dev` side by side (inside zellij)
migrate            # postgres migrations
seed               # reset and seed postgres (events, tickets) and mongo (settings)
```

Outside the devshell, every command also works as `nix run .#<command>`.

### Without Nix

Requires Node 22, Corepack (Yarn 4) and Docker Compose v2.

```bash
corepack enable
yarn install
docker compose -f apps/backend/docker-compose.yml up -d mongo db jaeger adminer mongo-express

cd apps/backend
yarn migrations:latest
yarn db:seed:all
cd ../..

yarn dev           # backend :3000, frontend :5173
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/v1 |
| Jaeger (traces) | http://localhost:16686 |
| Adminer (PostgreSQL) | http://localhost:8080 |
| mongo-express | http://localhost:8081 |
| Storybook | http://localhost:6006 |
| SonarQube | http://localhost:9000 |

## QA process

| Check | Nix | Without Nix |
|---|---|---|
| Unit tests + merged coverage | — | `yarn coverage` (report in `coverage/`) |
| Lint | `lint` | `yarn lint` |
| Format | `format [--check]` | `yarn format` / `yarn format:check` |
| Storybook interactions | `storybook` | `yarn workspace @st-hiring/frontend storybook` |
| SAST (SonarQube) | `sast` then `sast-analyze` | `docker compose -f apps/backend/docker-compose.yml up -d sonarqube` then `yarn sonar` |
| SCA (OWASP Dependency-Check) | `sca` | `dependency-check --scan . --out dependency-check-report` |
| DAST (OWASP ZAP) | `zap` | ZAP desktop, pointed at `http://localhost:3000` |

- **Storybook interactions**: the `play` functions in `*.stories.tsx` also run as Vitest tests (`*.stories.test.tsx`), so `yarn test` covers them too. They fully cover the two main components, `SettingsForm` and `PaginatedList`.
- **SAST**: `sast-analyze` reads the token from `SONAR_TOKEN` or a gitignored `.sonar-token`. It runs coverage first so SonarQube imports `coverage/lcov.info`.
- **SCA**: `sca` reads the NVD key from `NVD_API_KEY` or a gitignored `.nvd-api-key`. It writes HTML and JSON reports to `dependency-check-report/`.
- **DAST**: run the app first, then explore or spider the API with ZAP. The recorded session is in `dast/zapsession.session` (open it from ZAP with *File → Open Session*).

## Benchmarks and metrics

### `GET /v1/events`: ticket aggregate vs. full ticket list

Postman Runner, `page=1&pageSize=20` (20 events × 500 tickets = 10,000 tickets per request). The host had no fixed specs, so compare the numbers with each other, not against other systems.

| Metric | List of available tickets | Aggregate | Gain |
|---|---|---|---|
| Avg | 1.63 s | 160 ms | 10.18× |
| P90 | 2.20 s | 210 ms | 10.47× |
| P95 | 2.38 s | 227 ms | 10.48× |
| P99 | 3.38 s | 272 ms | 12.42× |
| Throughput (events/s) | 6,000 | 58,000 | ~9.7× |
| Throughput (tickets/s) | 120,000 | 1,160,000 | ~9.7× |

The aggregate run served as many requests in 2 minutes as the ticket-list run did in 5.

### Quality gates

| Type | Tool | Result |
|---|---|---|
| Unit tests | Vitest | backend 100.00% · shared 100.00% · frontend 98.01% · **total 98.20%** coverage |
| Functional UI | Storybook interactions | Full coverage of `SettingsForm` and `PaginatedList` |
| Lint | ESLint | 0 issues in backend, frontend and shared |
| SAST | SonarQube | Security 2 → 0 · Reliability 2 → 0 · Maintainability 6 → 0 · MTTR < 10 min |
| DAST | OWASP ZAP | Medium 4 → 0 · Low 3 → 1 · Informational 4 → 3 |
| SCA | OWASP Dependency-Check | Vulnerable versions found (see below) |

**SCA follow-up.** These packages need urgent upgrades. They stay pinned because the stack versions in each project's README cannot change:

| Package | Risk |
|---|---|
| `@faker-js/faker` | Arbitrary code execution |
| `path-to-regexp` | Denial of service |
| `tinypool` | Remote code execution |
| `vitest` | Arbitrary file I/O |
| `express` | Cross-site scripting |

### Observability

The backend is instrumented with OpenTelemetry for Node.js, Express, PostgreSQL and MongoDB. Traces go to Jaeger, and every request carries an `X-Transaction-Id` header so one transaction can be followed from end to end.
