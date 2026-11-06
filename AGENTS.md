# Software Architecture Document (SAD)

**Sistema:** ST Hiring — Eventos y Tickets (Eventim / See Tickets)
**Repositorios:** `st-hiring-backend`, `st-hiring-frontend`
**Fecha de revisión:** 2026-11-05
**Estado del código revisado:** commit `86cbaf0` (backend) y `2bf2581` (frontend) — *"Remove level label from README"*

---

## Índice

1. [Introducción](#1-introducción)
2. [Visión general del sistema](#2-visión-general-del-sistema)
3. [Restricciones y decisiones arquitectónicas](#3-restricciones-y-decisiones-arquitectónicas)
4. [Stack tecnológico](#4-stack-tecnológico)
5. [Vista lógica](#5-vista-lógica)
6. [Modelo de dominio y datos](#6-modelo-de-dominio-y-datos)
7. [Vista de procesos (flujos en tiempo de ejecución)](#7-vista-de-procesos-flujos-en-tiempo-de-ejecución)
8. [Vista de desarrollo (estructura de código)](#8-vista-de-desarrollo-estructura-de-código)
9. [Vista física / despliegue](#9-vista-física--despliegue)
10. [Patrones de diseño identificados](#10-patrones-de-diseño-identificados)
11. [Features implementadas vs. pendientes](#11-features-implementadas-vs-pendientes)
12. [Configuración del bundler (Vite)](#12-configuración-del-bundler-vite)
13. [Configuración de herramientas (TypeScript, ESLint, Prettier, Yarn, Nix)](#13-configuración-de-herramientas)
14. [Estrategia de pruebas](#14-estrategia-de-pruebas)
15. [Atributos de calidad](#15-atributos-de-calidad)
16. [Hallazgos de la revisión de código](#16-hallazgos-de-la-revisión-de-código)
17. [Pasos para ejecutar el proyecto](#17-pasos-para-ejecutar-el-proyecto)
18. [Arquitectura objetivo recomendada](#18-arquitectura-objetivo-recomendada)
19. [Riesgos y deuda técnica](#19-riesgos-y-deuda-técnica)
20. [Glosario](#20-glosario)

---

## 1. Introducción

### 1.1 Propósito

Este documento describe la arquitectura actual del sistema *ST Hiring*, compuesto por una API REST (backend) y una SPA (frontend). Documenta tecnologías, patrones, modelo de dominio, configuración de build, pruebas, procedimiento de ejecución y los hallazgos de una revisión completa del código, como base para la extensión del sistema (features de *settings* y paginación).

### 1.2 Alcance

| Componente | Descripción |
|---|---|
| `st-hiring-backend` | API REST en Node.js/Express + TypeScript que expone eventos y tickets almacenados en PostgreSQL. Prevé MongoDB para un documento de *settings*. |
| `st-hiring-frontend` | SPA en React 18 + TypeScript empaquetada con Vite. Dependencias de UI/estado/formularios ya instaladas (MUI, Redux Toolkit, Formik, Yup) pero aún sin usar. |

Ambos repositorios son la base de una **prueba técnica de contratación**: el código entregado es intencionalmente mínimo e incluye defectos que el candidato debe detectar y corregir (ver §16).

### 1.3 Audiencia

Desarrolladores que extiendan el sistema, revisores técnicos y evaluadores de la prueba.

### 1.4 Referencias

- `st-hiring-backend/Readme.md` — enunciado y setup del backend.
- `st-hiring-frontend/README.md` — enunciado y setup del frontend.
- Modelo 4+1 de Kruchten (estructura de vistas usada en este documento).

---

## 2. Visión general del sistema

### 2.1 Contexto (C4 — Nivel 1)

```mermaid
flowchart LR
    U[Usuario<br/>navegador] -->|HTTP :5173| FE[st-hiring-frontend<br/>SPA React + Vite]
    FE -->|proxy /events, /settings<br/>HTTP :3000| BE[st-hiring-backend<br/>API Express]
    BE -->|SQL via knex/pg<br/>:5432| PG[(PostgreSQL<br/>events, tickets)]
    BE -.->|driver mongodb<br/>:27017<br/>pendiente| MG[(MongoDB<br/>settings)]
    DEV[Desarrollador] -->|:8080| ADM[Adminer]
    DEV -->|:8081| ME[mongo-express]
    ADM --> PG
    ME --> MG
```

### 2.2 Contenedores (C4 — Nivel 2)

| Contenedor | Tecnología | Puerto | Responsabilidad |
|---|---|---|---|
| SPA | React 18, Vite 5 | 5173 (dev) | UI: listado de eventos paginado y formulario de settings (pendiente) |
| API | Node 22, Express 4.19.2, ts-node | 3000 | Endpoints REST `/health`, `/events`, `/settings` (pendiente) |
| PostgreSQL | imagen `postgres` (latest) | 5432 | Persistencia relacional de eventos y tickets |
| MongoDB | imagen `mongo` (latest) | 27017 | Persistencia documental de settings (pendiente) |
| Adminer | imagen `adminer` | 8080 | Administración web de PostgreSQL (solo dev) |
| mongo-express | imagen `mongo-express` | 8081 | Administración web de MongoDB (solo dev) |

### 2.3 Estilo arquitectónico

- **Cliente–servidor** con SPA desacoplada y API REST JSON.
- **Arquitectura en capas** en el backend: *Composition Root → Controller → DAL → Base de datos*.
- **Persistencia políglota**: relacional (PostgreSQL) para datos transaccionales y documental (MongoDB) para configuración.

---

## 3. Restricciones y decisiones arquitectónicas

### 3.1 Restricciones

| ID | Restricción | Origen |
|---|---|---|
| R1 | Node 22 (`.nvmrc`) | README de ambos repos |
| R2 | Yarn (Berry 3.x) como gestor; npm prohibido (`package-lock.json` en `.gitignore`) | README / `.gitignore` |
| R3 | Events y Tickets en PostgreSQL; Settings en MongoDB | README backend |
| R4 | Frontend: MUI, Redux Toolkit, Formik + Yup obligatorios | README frontend |
| R5 | Todo código nuevo o modificado debe tener tests unitarios | README de ambos repos |
| R6 | Seguir los patrones existentes del codebase | README backend |

### 3.2 Decisiones arquitectónicas (ADR resumidos)

| ADR | Decisión | Justificación | Consecuencia |
|---|---|---|---|
| ADR-01 | Express 4 como framework HTTP | Simplicidad, ecosistema | Sin manejo nativo de errores en handlers `async` (ver H-04) |
| ADR-02 | Knex como *query builder* (no ORM) | SQL explícito, migraciones y seeds integrados | No hay mapeo automático snake_case ↔ camelCase (ver H-06) |
| ADR-03 | DAL con *factory functions* + interfaces | Inyección de dependencias sin framework; facilita *mocking* | Patrón a replicar para `SettingsDAL` |
| ADR-04 | Controllers como *higher-order functions* que reciben dependencias | Testeables sin levantar servidor ni BD | Patrón a replicar en nuevos controllers |
| ADR-05 | Vite + `@vitejs/plugin-react` | Arranque y HMR rápidos, build con Rollup | Proxy dev evita CORS en el navegador |
| ADR-06 | Redux Toolkit para estado global | Requisito del enunciado | Pendiente de implementar (no hay store) |
| ADR-07 | `nodeLinker: node-modules` en Yarn Berry | Compatibilidad con tooling (ts-node, jest, eslint) | Se pierde el modo PnP / zero-installs estricto |

### 3.3 Decisiones: documentación automática de la API

Decisiones tomadas el 2026-11-05 para generar la documentación del backend. Estado: **Aceptada** (elegida explícitamente) o **Propuesta** (recomendada, pendiente de implementar).

| ADR | Decisión | Alternativas consideradas | Justificación | Estado |
|---|---|---|---|---|
| ADR-08 | Generar la especificación OpenAPI a partir de los esquemas Yup de `packages/shared` | YAML escrito a mano; comentarios con `swagger-jsdoc` | Los esquemas ya son la fuente de verdad de requests y responses; una especificación separada se desincroniza del código | Propuesta |
| ADR-09 | No usar frameworks basados en decoradores | tsoa; NestJS Swagger | Los controllers son *factory functions* (ADR-04); los decoradores obligarían a reescribir el backend (R6) | Propuesta |
| ADR-10 | Mantener Yup en lugar de migrar `shared` a Zod 4 | Zod 4 + Standard JSON Schema + `@asteasolutions/zod-to-openapi` | Yup 1.7.1 solo implementa la parte de validación de Standard Schema, no la salida a JSON Schema, por lo que la vía estandarizada exige Zod. Migrar implica reescribir `shared` y chocar con R4 (Formik + Yup) por una feature no requerida | Propuesta (recomendada) |
| ADR-11 | Convertir esquemas con `@sodaru/yup-to-json-schema` | *Walker* propio sobre `schema.describe()`; cambiar de librería | ~1M descargas semanales; es la opción de facto para Yup. El riesgo real es que no publica versiones desde abril de 2023, aceptable si queda aislado (ADR-12) | Propuesta (recomendada) |
| ADR-12 | Aislar el conversor en un único *wrapper* del backend (`toJsonSchema()`); ningún otro archivo importa `@sodaru/...` | Uso directo de la librería; instalarla en `shared` | Si falla, se cambia un solo archivo (alternativa: *walker* de ~150 líneas) y el bundle del frontend no carga tooling de documentación | Propuesta |
| ADR-13 | Describir `yup.lazy` y `mixed().test()` con `.meta({ oneOf })` / `.meta({ jsonSchema })`, tipado ampliando `CustomSchemaMetadata` de Yup | Exportar las ramas y componerlas solo en el backend; aceptar `{}` en la documentación | Los conversores no ven dentro de `lazy`, que usan todas las respuestas vía `createResponseSchema`; sin estas pistas la documentación mostraría esquemas vacíos | Propuesta |
| ADR-14 | Un registro `defineRoute()` alimenta tanto la validación de requests como la generación de la especificación | Metadatos de rutas exclusivos para documentación | El esquema que valida es el mismo que se documenta, así la documentación no puede divergir del comportamiento real | Propuesta |
| ADR-15 | OpenAPI 3.1.0, con fechas documentadas como `string` / `date-time` | OpenAPI 3.0.x | 3.1 usa JSON Schema 2020-12 directamente, así la salida del conversor (`type: [...]`, `null`) no requiere traducción; las fechas viajan como ISO en JSON | Propuesta |
| ADR-16 | Servir la documentación con Redoc (script *standalone* por CDN) en `/docs` y la especificación en `/openapi.json`, ambas registradas antes del *catch-all* `app.use('/')` | Swagger UI; Scalar | Preferencia del equipo; no requiere plugin de Express. Registradas después del *catch-all* quedarían ocultas (ver §7.3) | Aceptada |
| ADR-17 | Verificar la especificación automáticamente con un test que ejecuta `redocly lint` (opcionalmente validando *fixtures* con `ajv`) | Sin verificación | Detecta esquemas vacíos o inválidos de forma temprana y cumple R5 | Propuesta |

---

## 4. Stack tecnológico

### 4.1 Backend (`st-hiring-backend`)

| Categoría | Tecnología | Versión (lock) | Uso actual |
|---|---|---|---|
| Runtime | Node.js | 22 | ✅ |
| Lenguaje | TypeScript | 5.5.2 | ✅ (código de app); migraciones/seeds en JS |
| HTTP | Express | 4.19.2 | ✅ |
| Middleware | cors | ^2.8.5 | ✅ (abierto a cualquier origen) |
| Config | dotenv | ^16.4.5 | ✅ (`import 'dotenv/config'`) |
| SQL builder | knex | 3.1.0 | ✅ |
| Driver PG | pg | 8.12.0 | ✅ (vía knex) |
| Driver Mongo | mongodb | 6.8.0 | ❌ instalado, no usado |
| Dev server | nodemon + ts-node | ^3.1.4 / ^10.9.2 | ✅ |
| Test | jest + ts-jest + @types/jest | ^29 | ❌ sin config ni tests |
| Datos falsos | @faker-js/faker | ^8.4.1 | ✅ (seed) |
| Lint | eslint | 9.6.0 | ⚠️ roto (ver H-13) |
| Formato | prettier | 3.3.2 | ✅ (`.prettierrc`) |
| Otros | ts-loader | ^9.5.1 | ❌ no usado (no hay webpack) |
| Gestor | Yarn | 3.6.1 (`.yarn/releases`) | ✅ |
| Infra local | Docker Compose | — | ✅ |

### 4.2 Frontend (`st-hiring-frontend`)

| Categoría | Tecnología | Versión (lock) | Uso actual |
|---|---|---|---|
| Lenguaje | TypeScript | 5.5.2 | ✅ |
| UI library | React / React DOM | 18.3.1 | ✅ |
| Bundler / dev server | Vite | 5.3.1 | ✅ |
| Plugin | @vitejs/plugin-react (Babel, Fast Refresh) | ^4.3.1 | ✅ |
| Componentes | @mui/material + @emotion/react + @emotion/styled | 5.15.20 | ❌ instalado, no usado |
| Estado | @reduxjs/toolkit + react-redux | 2.2.5 / ^9.1.2 | ❌ instalado, no usado |
| Formularios | formik | ^2.4.6 | ❌ instalado, no usado |
| Validación | yup | ^1.4.0 | ❌ instalado, no usado |
| Lint | eslint 8 + @typescript-eslint 7 + react-hooks + react-refresh | — | ✅ |
| Test | — | — | ❌ no hay librería (el enunciado pide elegir una) |
| Gestor | Yarn | 3.6.4 (`.yarn/releases`) | ✅ |
| Dev shell | Nix flake (solo `bun`) | — | ⚠️ inconsistente (ver H-22) |

---

## 5. Vista lógica

### 5.1 Componentes del backend

```mermaid
flowchart TB
    subgraph Composition Root [src/index.ts]
        CFG[knexfile.ts<br/>dbConfig.development]
        KNX[Instancia Knex]
        APP[Express app<br/>cors, json]
    end
    subgraph Controllers [src/controllers]
        GEC[createGetEventsController]
    end
    subgraph DAL [src/dal]
        EDAL[EventDAL<br/>getEvents limit]
        TDAL[TicketsDAL<br/>getTicketsByEvent eventId]
    end
    subgraph Entities [src/entity]
        EV[Event]
        TK[Ticket]
    end
    CFG --> KNX
    KNX --> EDAL
    KNX --> TDAL
    APP -->|/events| GEC
    GEC --> EDAL
    GEC --> TDAL
    EDAL -.usa.-> EV
    TDAL -.usa.-> TK
    EV -.contiene.-> TK
```

### 5.2 Responsabilidades por capa

| Capa | Archivo(s) | Responsabilidad | Observación |
|---|---|---|---|
| Composition Root | `src/index.ts` | Crea Knex, instancia DALs, monta middlewares y rutas, arranca el servidor | Mezcla el *wiring* con `app.listen`, lo que impide testear la app con supertest sin abrir puerto |
| Configuración | `src/knexfile.ts` | Configuración de conexión, pool, migraciones y seeds | Solo entorno `development` |
| Controller | `src/controllers/get-events.ts` | Orquesta lectura de eventos y tickets, filtra disponibles, responde JSON | Contiene lógica de negocio (filtro) — no hay capa de servicio |
| DAL | `src/dal/*.dal.ts` | Acceso a datos con Knex, devuelve entidades tipadas | Tipado engañoso (columnas snake_case vs. props camelCase) |
| Entidades | `src/entity/*.ts` | Interfaces TypeScript del dominio | Solo tipos, sin comportamiento (modelo anémico) |
| Persistencia | `src/database/migrations`, `seeds` | Esquema y datos de prueba | En JavaScript (CommonJS) |

### 5.3 Componentes del frontend

```mermaid
flowchart TB
    HTML[index.html<br/>#root] --> MAIN[src/main.tsx<br/>createRoot + StrictMode]
    MAIN --> APP[src/App.tsx<br/>placeholder]
    MAIN --> CSS[src/index.css<br/>estilos plantilla Vite]
```

Actualmente es la plantilla de Vite (`react-ts`) con un título "See Tickets". No hay store, rutas, servicios HTTP ni componentes de dominio.

---

## 6. Modelo de dominio y datos

### 6.1 Objetos de dominio (TypeScript)

```ts
// src/entity/event.ts
interface Event {
  id: number;
  name: string;
  date: Date;
  location: string;          // en BD es NULLABLE → debería ser string | null
  description: string;
  availableTickets: Ticket[]; // campo calculado, NO existe en la tabla
  createdAt: Date;           // en BD: created_at
  updatedAt: Date;           // en BD: updated_at
}

// src/entity/ticket.ts
interface Ticket {
  id: number;
  eventId: number;           // en BD: event_id
  type: string;              // valores observados: 'general'
  status: string;            // valores observados: 'available' | 'sold' | 'reserved'
  price: number;             // entero (centavos, p. ej. 1000 = 10.00)
  createdAt: Date;
  updatedAt: Date;
}
```

```mermaid
classDiagram
    class Event {
        +number id
        +string name
        +Date date
        +string location
        +string description
        +Ticket[] availableTickets
        +Date createdAt
        +Date updatedAt
    }
    class Ticket {
        +number id
        +number eventId
        +string type
        +string status
        +number price
        +Date createdAt
        +Date updatedAt
    }
    class Settings {
        <<pendiente - MongoDB>>
    }
    Event "1" --> "0..*" Ticket : availableTickets
```

**Características del modelo:**

- **Modelo anémico**: las entidades son interfaces sin comportamiento; las reglas (p. ej. "ticket disponible") viven en el controller.
- **Agregado implícito**: `Event` es la raíz y `Ticket` pertenece a un único evento (FK con `ON DELETE CASCADE`).
- **Value objects ausentes**: `status` y `type` son `string` libres; `price` es un entero sin moneda. Se recomienda tiparlos como uniones literales (`'available' | 'sold' | 'reserved'`) o enums, y modelar `Money` (monto en centavos + moneda).
- **`Settings`**: no existe. El enunciado deja su forma a criterio del desarrollador (documento único en MongoDB).

### 6.2 Esquema relacional (PostgreSQL)

```mermaid
erDiagram
    EVENTS ||--o{ TICKETS : "tiene"
    EVENTS {
        serial id PK
        varchar_255 name "NOT NULL"
        varchar_255 description "NOT NULL"
        varchar_255 location "NULL"
        timestamptz date "NOT NULL"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
    }
    TICKETS {
        serial id PK
        integer event_id FK "NOT NULL, ON DELETE CASCADE"
        varchar_255 status "NOT NULL"
        varchar_255 type "NOT NULL"
        integer price "NOT NULL"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
    }
```

Migraciones (`src/database/migrations`):

| Migración | Acción |
|---|---|
| `20240628195142_CreateEventsTable.js` | Crea `events` (`table.timestamps(true, true)` → `created_at`/`updated_at` con default `now()`) |
| `20240628195536_CreateTicketsTable.js` | Crea `tickets` con FK a `events.id` (`CASCADE`) |

**Observaciones del esquema:**

- No hay índice sobre `tickets.event_id` (PostgreSQL no indexa FKs automáticamente) → *seq scan* en cada consulta por evento (H-03).
- No hay índice sobre `tickets.status` ni índice compuesto `(event_id, status)`, necesario para el filtro de disponibles.
- `status`/`type` sin `CHECK` constraint ni enum.
- `description` es `varchar(255)` mientras el seed genera `faker.lorem.paragraph()`, que puede superar 255 caracteres → fallo intermitente del seed (H-17).
- `.unsigned()` en `event_id` no tiene efecto en PostgreSQL.

### 6.3 Datos de prueba (seed)

`src/database/seeds/events-tickets-seed.js`: por ejecución inserta **100 eventos** y luego **500 tickets por cada evento existente en la tabla** (no solo los nuevos). Ejecutarlo *n* veces produce `100·n` eventos y `500·100·n·(n+1)/2` tickets acumulados — crecimiento cuadrático. Las inserciones son fila a fila (50 000 `INSERT` en la primera ejecución).

### 6.4 Modelo documental (MongoDB) — pendiente

Variable `MONGO_URI` definida en `.env.example` y driver `mongodb` instalado, pero sin cliente, colección ni DAL. Propuesta en §18.

---

## 7. Vista de procesos (flujos en tiempo de ejecución)

### 7.1 `GET /events` (estado actual)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant E as Express
    participant GC as GetEventsController
    participant ED as EventDAL
    participant TD as TicketsDAL
    participant DB as PostgreSQL

    C->>E: GET /events
    E->>GC: handler(req, res)
    GC->>ED: getEvents(50)
    ED->>DB: SELECT * FROM events LIMIT 50
    DB-->>ED: 50 filas
    loop por cada evento (N = 50), secuencial
        GC->>TD: getTicketsByEvent(event.id)
        TD->>DB: SELECT * FROM tickets WHERE event_id = ?
        DB-->>TD: ~500·k filas
        GC->>GC: filter(status === 'available')
    end
    GC-->>C: 200 JSON Event[] (snake_case + availableTickets)
```

Problemas del flujo: **N+1 consultas** secuenciales (51 queries), transferencia de todos los tickets para filtrar en memoria, límite fijo de 50, sin orden determinista (`ORDER BY`), sin `try/catch` y respuesta potencialmente de decenas de MB.

### 7.2 `GET /health`

Responde `{ "status": "ok" }` sin verificar conectividad a PostgreSQL/MongoDB (es *liveness*, no *readiness*).

### 7.3 Ruta raíz `/`

`app.use('/')` actúa como **catch-all**: cualquier ruta no registrada y cualquier método responde `200 {"message":"Hello API"}` en lugar de `404`.

---

## 8. Vista de desarrollo (estructura de código)

### 8.1 Backend

```
st-hiring-backend/
├── src/
│   ├── index.ts                     # Composition root + servidor HTTP
│   ├── knexfile.ts                  # Config Knex (CLI y runtime)
│   ├── controllers/
│   │   └── get-events.ts            # Controller factory GET /events
│   ├── dal/
│   │   ├── events.dal.ts            # EventDAL (interface + factory)
│   │   └── tickets.dal.ts           # TicketsDAL (interface + factory)
│   ├── entity/
│   │   ├── event.ts                 # interface Event
│   │   └── ticket.ts                # interface Ticket
│   └── database/
│       ├── migrations/*.js          # Esquema PostgreSQL
│       └── seeds/events-tickets-seed.js
├── docker-compose.yml               # mongo, mongo-express, postgres, adminer
├── nodemon.json                     # ts → ts-node
├── tsconfig.json                    # CommonJS, ES2022
├── .eslintrc.json / .prettierrc / .editorconfig
├── .env.example
├── .yarnrc.yml / .yarn/ (release 3.6.1, plugin workspace-tools, sdks, cache)
└── .vscode/                         # SDKs de Yarn para ESLint/Prettier/TS
```

**Convenciones:** archivos en *kebab-case*; sufijo `.dal.ts` para la capa de datos; *factories* nombradas `createXxx`; interfaces de DAL exportadas junto a su factory; comillas simples, `printWidth: 120`, indentación 2 espacios, LF.

> Inconsistencias: `EventDAL` vs `TicketsDAL` (singular/plural), `createTicketDAL` devuelve `TicketsDAL`, variable `TicketDAL` en PascalCase en `index.ts`, comillas dobles en `knexfile.ts`/`entity`/`controller` que contradicen `.prettierrc`, `;` sobrantes tras las interfaces.

### 8.2 Frontend

```
st-hiring-frontend/
├── index.html                # Entrada HTML (referencia /vite.svg, inexistente)
├── src/
│   ├── main.tsx              # Bootstrap React 18 (createRoot, StrictMode)
│   ├── App.tsx               # Componente placeholder
│   ├── index.css             # CSS de plantilla Vite
│   └── vite-env.d.ts         # Tipos de cliente Vite
├── vite.config.ts            # Plugin React + proxy al backend
├── tsconfig.json             # Solution file (references)
├── tsconfig.app.json         # Código de la app (bundler mode, strict)
├── tsconfig.node.json        # vite.config.ts
├── .eslintrc.cjs
├── flake.nix                 # Dev shell Nix (bun)
└── .yarnrc.yml / .yarn/      # Yarn 3.6.4, cache offline
```

---

## 9. Vista física / despliegue

### 9.1 Entorno local (único entorno definido)

```mermaid
flowchart LR
    subgraph Host [Máquina del desarrollador]
        V[Vite dev server :5173]
        N[nodemon + ts-node :3000]
        subgraph Docker Compose
            PG[(postgres :5432)]
            MO[(mongo :27017)]
            AD[adminer :8080]
            MX[mongo-express :8081]
        end
    end
    V -- proxy --> N
    N --> PG
    N -.-> MO
    AD --> PG
    MX --> MO
```

### 9.2 Observaciones de despliegue

- **No existe Dockerfile** para la API ni para la SPA; `.dockerignore` hace referencia a una estructura de monorepo (`lerna.json`, `apps/`, `packages/`) que no existe → archivo heredado de otro proyecto.
- `docker-compose.yml` usa `version: '3'` (obsoleto en Compose v2, genera *warning*), imágenes sin versión fija (`latest`), sin volúmenes (los datos se pierden al recrear contenedores) y sin *healthchecks*.
- Credenciales `root/example` en texto plano (aceptable solo para desarrollo).
- No hay script `build` en el backend (se ejecuta con ts-node también en "producción"); `tsconfig` sí define `outDir: dist`.
- No hay pipeline CI/CD.
- Puerto 3000 *hardcodeado* en `index.ts` (sin `process.env.PORT`).

---

## 10. Patrones de diseño identificados

| Patrón | Dónde | Descripción | Valoración |
|---|---|---|---|
| **Layered Architecture** | Backend | Controller → DAL → DB, entidades compartidas | ✅ Adecuado; falta capa de servicio para lógica de negocio |
| **Data Access Layer / Repository (ligero)** | `src/dal/*.dal.ts` | Interfaz (`EventDAL`, `TicketsDAL`) + implementación con Knex | ✅ Permite sustituir la implementación y *mockear* en tests |
| **Factory Function** | `createEventDAL`, `createTicketDAL`, `createGetEventsController` | Funciones que construyen objetos/handlers con dependencias capturadas en *closure* | ✅ Idiomático en TS funcional, sin clases ni `this` |
| **Dependency Injection manual (constructor/closure injection)** | `index.ts` → controllers/DALs | Las dependencias (Knex, DALs) se pasan explícitamente | ✅ Testeable sin contenedor DI |
| **Composition Root** | `src/index.ts` | Único punto donde se ensamblan dependencias | ✅ — aunque acoplado a `app.listen` |
| **Higher-Order Function (handler factory)** | `createGetEventsController` | Devuelve `(req, res) => …` | ✅ |
| **Middleware / Chain of Responsibility** | Express (`cors`, `express.json`) | Pipeline de middlewares | ✅ Falta middleware de errores y 404 |
| **Query Builder** | Knex | Construcción programática de SQL | ✅ |
| **Database Migrations (Evolutionary DB design)** | `knex migrate` | Versionado del esquema | ✅ |
| **Seeding / Test Data Builder** | Seed con faker | Generación de datos sintéticos | ⚠️ No idempotente, lento |
| **Twelve-Factor Config** | `dotenv` + `process.env` con defaults | Config por entorno | ⚠️ Parcial (puerto fijo, un solo entorno knex) |
| **Polyglot Persistence** | PostgreSQL + MongoDB | Almacén según naturaleza del dato | ⏳ Mongo pendiente |
| **Reverse Proxy (dev)** | `vite.config.ts` → `server.proxy` | El dev server reenvía `/events`, `/settings` | ✅ Evita CORS y URLs absolutas en el front |
| **SPA + Flux/Redux** (previsto) | Frontend | Store único, *slices*, *thunks* | ⏳ Pendiente |

**Antipatrones detectados:** N+1 queries, *Anemic Domain Model* con lógica en el controller, *catch-all route* que oculta 404, *magic numbers* (`50`, `3000`), dependencia muerta (`mongodb`, `ts-loader`), configuración huérfana (`.dockerignore`, `experimentalDecorators`/`emitDecoratorMetadata` sin decoradores).

---

## 11. Features implementadas vs. pendientes

### 11.1 Backend

| Feature | Estado | Detalle |
|---|---|---|
| `GET /health` | ✅ Implementado | Liveness simple |
| `GET /events` | ⚠️ Implementado con defectos | Límite fijo 50, N+1, sin paginación, sin manejo de errores |
| Tickets disponibles por evento | ⚠️ | Filtrado en memoria dentro de `/events` |
| Migraciones y seed | ✅ | Ver H-16, H-17 |
| `GET /settings` | ❌ Pendiente (Tarea 1) | MongoDB |
| `POST /settings` (upsert) | ❌ Pendiente (Tarea 1) | MongoDB |
| Paginación `/events` | ❌ Pendiente (Tarea 2) | `page`, `pageSize`, metadatos |
| Revisión de calidad | ❌ Pendiente (Tarea 3) | Ver §16 |
| Tests unitarios | ❌ Pendiente (Tarea 4) | Jest instalado sin config |

### 11.2 Frontend

| Feature | Estado | Detalle |
|---|---|---|
| Bootstrap React + Vite | ✅ | Plantilla |
| Proxy al backend | ✅ | `/events`, `/settings` |
| Listado de eventos paginado (MUI + Redux) | ❌ Pendiente (Tarea 1) | |
| Formulario de settings (MUI + Redux + Formik + Yup) | ❌ Pendiente (Tarea 2) | |
| Revisión de calidad | ❌ Pendiente (Tarea 3) | CSS plantilla, favicon roto, estilos inline |
| Tests unitarios | ❌ Pendiente (Tarea 4) | Sin librería instalada |

---

## 12. Configuración del bundler (Vite)

### 12.1 `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/events': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
    },
  },
})
```

| Aspecto | Configuración | Efecto |
|---|---|---|
| Plugin | `@vitejs/plugin-react` 4.x | Transformación JSX con Babel (runtime automático, `jsx: react-jsx`) y **React Fast Refresh** (HMR que preserva estado) |
| Dev server | Puerto por defecto **5173** | Sirve módulos ESM nativos sin empaquetar; pre-bundling de dependencias con **esbuild** (`node_modules/.vite`) |
| Proxy | `/events` y `/settings` → `http://localhost:3000` | Las llamadas `fetch('/events?page=1')` del navegador llegan al backend como mismo origen; sin CORS ni URLs absolutas. **Solo aplica en `vite dev`** (y `vite preview` no lo hereda salvo configurar `preview.proxy`) |
| Build | Por defecto (`vite build`) | **Rollup**: salida en `dist/`, *tree-shaking*, *code-splitting*, minificación con esbuild, hashes en nombres de assets, target `modules` (navegadores con ESM nativo) |
| Entrada | `index.html` → `<script type="module" src="/src/main.tsx">` | Vite usa el HTML como punto de entrada |
| Assets públicos | Carpeta `public/` | **No existe**; `index.html` referencia `/vite.svg` → 404 del favicon |
| Variables de entorno | `import.meta.env` (prefijo `VITE_`) | No se usan; tipos vía `src/vite-env.d.ts` |
| Type-check | **No lo hace Vite** (esbuild solo elimina tipos) | Se delega a `tsc -b` en el script `build` |

### 12.2 Scripts

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `vite` | Dev server con HMR + proxy |
| `build` | `tsc -b && vite build` | Type-check de los proyectos referenciados (`tsconfig.app.json`, `tsconfig.node.json`, `noEmit`) y luego build de producción |
| `preview` | `vite preview` | Sirve `dist/` en `:4173` (sin proxy configurado → las llamadas API fallarán) |
| `lint` | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` | Lint estricto (0 warnings) |

### 12.3 Recomendaciones Vite

1. Añadir `test` (Vitest) reutilizando la misma config: `test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.ts' }`.
2. Definir `preview.proxy` igual que `server.proxy`, o extraer el objeto a una constante compartida.
3. Para producción, sustituir el proxy por `VITE_API_BASE_URL` o un reverse proxy (nginx) delante del `dist/`.
4. Crear `public/` con el favicon o eliminar la referencia en `index.html`.
5. Opcional: `@vitejs/plugin-react-swc` para builds más rápidos; `manualChunks` para separar MUI.

---

## 13. Configuración de herramientas

### 13.1 TypeScript

| Opción | Backend (`tsconfig.json`) | Frontend (`tsconfig.app.json`) |
|---|---|---|
| `target` | ES2022 | ES2020 |
| `module` | CommonJS | ESNext |
| `moduleResolution` | (por defecto: node10) | bundler |
| `strict` | **❌ no activado** | ✅ |
| `noEmit` | no (`outDir: dist`, `declaration`, `sourceMap`) | sí (Vite compila) |
| `composite` | sí | sí (project references) |
| `jsx` | — | react-jsx |
| Extras | `experimentalDecorators`, `emitDecoratorMetadata` (sin uso), `types: [jest, node]` | `allowImportingTsExtensions`, `isolatedModules`, `moduleDetection: force` |

El backend sin `strict` permite `any` implícitos y `null` no controlados (p. ej. `location` nullable tipado como `string`).

### 13.2 ESLint

- **Backend**: `.eslintrc.json` (formato *legacy*) con `@typescript-eslint` y `jest`, pero ESLint instalado es **9.6.0** (por defecto solo lee `eslint.config.js` *flat config*) y **no están instalados** `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` ni `eslint-plugin-jest`. No hay script `lint`. → El lint del backend **no funciona**.
- **Frontend**: ESLint 8.57 + `@typescript-eslint` 7 + `react-hooks` + `react-refresh` (`only-export-components`). Funcional.

### 13.3 Prettier / EditorConfig

Backend: Prettier 3.3.2 (`singleQuote`, `trailingComma: all`, `printWidth: 120`), EditorConfig (LF, UTF-8, 2 espacios). Frontend: sin Prettier configurado.

### 13.4 Yarn (Berry)

| | Backend | Frontend |
|---|---|---|
| Versión | 3.6.1 | 3.6.4 |
| `nodeLinker` | node-modules (`nmMode: classic`) | node-modules (`nmMode: hardlinks-local`) |
| Cache offline | `.yarn/cache` | `.yarn/cache` (362 paquetes) |
| Extras | plugin `workspace-tools`, `npmAuthToken` por `NPM_TOKEN`, `packageExtensions` de redoc/styled-components (heredados, sin uso) | `enableTelemetry: false` |

### 13.5 Nix

`st-hiring-frontend/flake.nix` define un `devShell` que solo provee **bun**, no Node 22 ni Yarn/corepack (pese a la descripción "Node.js dev shell with corepack"). Es inconsistente con `.nvmrc` y con el uso de Yarn.

### 13.6 nodemon

`nodemon.json`: ejecuta `.ts` con `ts-node`, ignora `*.test.js` y `fixtures/`. Como los tests serán `*.test.ts`, conviene ignorar también ese patrón.

---

## 14. Estrategia de pruebas

### 14.1 Estado actual

| Repo | Framework | Configuración | Tests existentes | Cobertura |
|---|---|---|---|---|
| Backend | Jest 29 + ts-jest | ❌ No hay `jest.config` ni `preset` en `package.json` → Jest no transformará `.ts` | **0** | 0 % |
| Frontend | Ninguno | — | **0** | 0 % |

`yarn test` en el backend hoy termina con *"No tests found"* (exit code 1).

### 14.2 Estrategia propuesta

```mermaid
flowchart TB
    E2E[E2E - opcional<br/>Playwright: listado + settings]
    INT[Integración<br/>supertest sobre app Express<br/>Testcontainers / docker compose para PG y Mongo]
    UNIT[Unitarias<br/>controllers con DAL mock<br/>DAL con knex mock / pg-mem<br/>slices y thunks Redux<br/>componentes con RTL]
    E2E --- INT --- UNIT
```

**Backend**

1. `jest.config.ts` con `preset: 'ts-jest'`, `testEnvironment: 'node'`, `roots: ['<rootDir>/src']`.
2. Separar `createApp(deps)` de `app.listen` para testear rutas con **supertest** sin abrir puerto.
3. **Controllers**: inyectar DALs falsos (`jest.fn()`), verificar parseo/validación de `page`/`pageSize`, forma de la respuesta, códigos 400/500.
4. **DAL**: tests con `knex` contra **pg-mem** o contenedor real (integración); verificar `LIMIT/OFFSET`, `ORDER BY`, `COUNT`.
5. **Settings DAL**: `mongodb-memory-server` o mock de `Collection` (`findOne`, `findOneAndUpdate({upsert:true})`).
6. Validación de entrada (zod/joi) con tests de esquema.

**Frontend**

1. **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **jsdom** (integración nativa con Vite).
2. Slices de Redux: tests de reducers puros y de thunks (con `fetch` mockeado o **MSW**).
3. Componentes: render con un `store` real de pruebas (`renderWithProviders`), interacción de paginación y validación Yup del formulario.

**Calidad**: umbral de cobertura (p. ej. 80 % líneas en código nuevo), ejecución en CI.

---

## 15. Atributos de calidad

| Atributo | Estado actual | Riesgo | Mejora |
|---|---|---|---|
| **Rendimiento** | N+1 (51 queries), ~10–25k filas transferidas por request, sin índices | 🔴 Alto | JOIN/agregación en SQL, índice `(event_id, status)`, paginación |
| **Escalabilidad** | Respuesta crece con datos; seed cuadrático | 🔴 | Paginación + límite máximo de `pageSize` |
| **Disponibilidad / Robustez** | Excepciones `async` no capturadas → request colgada / `unhandledRejection` | 🔴 | Middleware de errores, wrapper async o Express 5 |
| **Mantenibilidad** | Código pequeño y modular; patrones claros | 🟢 | Capa de servicio, mappers |
| **Testeabilidad** | DI manual favorable; sin tests ni config | 🟡 | Ver §14 |
| **Seguridad** | CORS abierto, sin validación de entrada, sin `helmet`, sin rate-limit, credenciales dev en compose, `SELECT *` | 🟡 | `helmet`, CORS restringido, validación, límites de payload |
| **Observabilidad** | Solo `console.log('Server Started')` | 🟡 | Logger estructurado (pino), request-id, health/readiness |
| **Portabilidad** | Docker Compose para BDs; sin Dockerfile de app | 🟡 | Dockerfiles multi-stage |
| **Usabilidad (UI)** | Plantilla sin funcionalidad | — | MUI responsive (Grid/Stack, `useMediaQuery`) |

---

## 16. Hallazgos de la revisión de código

Severidad: 🔴 Alta · 🟠 Media · 🟡 Baja

### 16.1 Backend

| ID | Sev. | Archivo | Hallazgo | Recomendación |
|---|---|---|---|---|
| H-01 | 🔴 | `controllers/get-events.ts` | **N+1 queries**: 1 query de eventos + 1 por evento, ejecutadas secuencialmente con `await` dentro del `for`. | Una sola query `WHERE event_id IN (…) AND status = 'available'` y agrupar en memoria, o JOIN/`json_agg` en SQL. |
| H-02 | 🔴 | `controllers/get-events.ts` | Se traen **todos** los tickets (incl. vendidos/reservados) y se filtran en JS. | Filtrar `status = 'available'` en la BD (nuevo método DAL `getAvailableTicketsByEventIds`). Considerar devolver solo el conteo si el front no necesita cada ticket. |
| H-03 | 🔴 | migración tickets | Sin índice en `tickets.event_id` (ni `status`). | Nueva migración: `table.index(['event_id', 'status'])`. |
| H-04 | 🔴 | `controllers/get-events.ts` | Handler `async` sin `try/catch`; Express 4 no captura promesas rechazadas → la petición queda colgada y se emite `unhandledRejection`. | `try/catch` + `next(err)`, wrapper `asyncHandler`, y middleware de errores final `(err, req, res, next)` que responda 500. |
| H-05 | 🔴 | `controllers/get-events.ts` | Límite **hardcodeado** a 50, sin paginación ni `ORDER BY` (orden no determinista entre páginas). | `?page=&pageSize=` validados (enteros ≥1, `pageSize ≤ 100`), `ORDER BY date, id`, respuesta `{ data, pagination: { page, pageSize, total, totalPages } }`. |
| H-06 | 🟠 | `dal/*.dal.ts`, `entity/*` | Las filas vienen en **snake_case** (`event_id`, `created_at`) pero se tipan como entidades camelCase (`eventId`, `createdAt`): el tipado miente y el JSON de salida es inconsistente. | `knexSnakeCaseMappers()` de `objection` o `postProcessResponse`/`wrapIdentifier` en la config de Knex, o mappers explícitos fila→entidad. |
| H-07 | 🟠 | `index.ts` | `app.use('/health')`, `app.use('/events')` y `app.use('/')` aceptan **cualquier método** y prefijo; `/` es catch-all → nunca hay 404 (p. ej. `DELETE /events` ejecuta el listado). | `app.get(...)` o `express.Router()` por recurso; middleware 404 al final. |
| H-08 | 🟠 | `controllers/get-events.ts` | Mutación del array devuelto por el DAL (`events[i].availableTickets = …`). | Construir objetos nuevos con `map`. |
| H-09 | 🟠 | `entity/event.ts` | `location` es nullable en BD pero tipado `string`; `availableTickets` mezcla entidad persistida y DTO de respuesta. | `location: string \| null`; separar `EventRow` / `EventWithTicketsDTO`. |
| H-10 | 🟠 | `entity/ticket.ts` | `status` y `type` como `string` libre. | `type TicketStatus = 'available' \| 'sold' \| 'reserved'`. |
| H-11 | 🟠 | `index.ts` | Puerto 3000 fijo; sin cierre ordenado (`SIGTERM` → `server.close()`, `knex.destroy()`, `mongoClient.close()`). | `process.env.PORT ?? 3000`, *graceful shutdown*. |
| H-12 | 🟠 | `tsconfig.json` | `strict` desactivado. | Activar `strict: true`. |
| H-13 | 🟠 | `.eslintrc.json` / `package.json` | ESLint 9 con config *legacy* y plugins no instalados → lint inoperante; sin script `lint`. | Migrar a `eslint.config.js` (flat) con `typescript-eslint` y `eslint-plugin-jest`, añadir script. |
| H-14 | 🟠 | `package.json` | Jest sin configuración para TypeScript; sin tests. | `jest.config.ts` con `ts-jest`. |
| H-15 | 🟡 | `index.ts` | `TicketDAL` en PascalCase; `EventDAL` vs `TicketsDAL`; `createTicketDAL` → `TicketsDAL`. | Unificar nombres (`eventsDAL`, `ticketsDAL`, `EventsDAL`). |
| H-16 | 🟡 | seed | 50 000 `INSERT` individuales; además genera tickets para **todos** los eventos existentes en cada ejecución (crecimiento cuadrático). | `knex.batchInsert` o inserts por lotes; generar tickets solo para los eventos recién insertados (`.returning('id')`). |
| H-17 | 🟡 | seed / migración events | `faker.lorem.paragraph()` puede exceder `varchar(255)` de `description`. | `table.text('description')` o `faker.lorem.sentence()`. |
| H-18 | 🟡 | `package.json` | Flags de scripts incoherentes: `migrations:make` usa `src/database/migrations` sin `--knexfile`; `db:seed` usa `--migrations-directory` (debería ser `--seeds-directory`, aunque el knexfile lo resuelve). | Confiar en `knexfile.ts` y eliminar flags redundantes. |
| H-19 | 🟡 | `knexfile.ts` | `module.exports = dbConfig` **y** `export default dbConfig` (el primero es sobrescrito por la compilación TS); solo entorno `development`. | Un único `export`; entornos `test`/`production` o selección por `NODE_ENV`. |
| H-20 | 🟡 | Dependencias / config | `mongodb` y `ts-loader` sin uso; `experimentalDecorators`/`emitDecoratorMetadata` sin decoradores; `.dockerignore` y `packageExtensions` heredados de otro monorepo. | Limpiar o usar (Mongo para settings). |
| H-21 | 🟡 | `docker-compose.yml` | `version` obsoleto, imágenes `latest`, sin volúmenes ni healthchecks; `adminer` con `restart: always`. | Fijar versiones (`postgres:16`, `mongo:7`), volúmenes nombrados, `healthcheck`. |
| H-22 | 🟡 | `index.ts` | `cors()` sin restricción de origen; sin `helmet`; `express.json()` sin límite explícito. | CORS por `ALLOWED_ORIGINS`, `helmet()`. |
| H-23 | 🟡 | DAL | `SELECT *` expone todas las columnas. | Seleccionar columnas explícitas. |

### 16.2 Frontend

| ID | Sev. | Archivo | Hallazgo | Recomendación |
|---|---|---|---|---|
| F-01 | 🟠 | `src/index.css` | CSS de la plantilla Vite (`body { display:flex; place-items:center }`, estilos globales de `button`, `h1 3.2em`, fondo oscuro) **choca con MUI** y rompe layouts responsive. | Eliminar y usar `ThemeProvider` + `CssBaseline` de MUI. |
| F-02 | 🟠 | `src/App.tsx` | Estilos inline con `100vw` (provoca scroll horizontal cuando hay scrollbar vertical); clase `.card` sin definir; texto de plantilla. | Layout con `Container`/`Box`/`Stack` de MUI. |
| F-03 | 🟠 | — | MUI, Redux, Formik, Yup instalados pero sin `Provider`, store, ni tema. | `configureStore`, `<Provider>`, `ThemeProvider` en `main.tsx`. |
| F-04 | 🟠 | — | Sin librería de tests. | Vitest + RTL + jsdom (+ MSW). |
| F-05 | 🟡 | `index.html` | Favicon `/vite.svg` inexistente (no hay `public/`). | Añadir el recurso o quitar la referencia. |
| F-06 | 🟡 | `main.tsx` | Importa `./App.tsx` con extensión (permitido por `allowImportingTsExtensions`, pero inconsistente); *non-null assertion* `getElementById('root')!`. | Import sin extensión; comprobar el nodo y lanzar error descriptivo. |
| F-07 | 🟡 | `vite.config.ts` | Proxy solo en `server`, no en `preview`. | Compartir config de proxy. |
| F-08 | 🟡 | `flake.nix` | Solo provee `bun` (no Node 22 ni Yarn), contradiciendo su descripción y `.nvmrc`; indentación con tabs mezclados. | `packages = [ nodejs_22 corepack ]`. |
| F-09 | 🟡 | Repos | Versiones de Yarn distintas (3.6.1 vs 3.6.4) y sin Prettier en el front. | Alinear tooling. |

---

## 17. Pasos para ejecutar el proyecto

### 17.1 Prerrequisitos

- **Node.js 22** (vía `nvm`; o `nix develop` ajustando el flake, ver F-08)
- **Yarn** — se usa el binario versionado en `.yarn/releases` (`corepack enable` recomendado)
- **Docker** + **Docker Compose v2**
- Puertos libres: 3000, 5173, 5432, 27017, 8080, 8081

### 17.2 Backend

```bash
cd st-hiring-backend
nvm use                    # Node 22
yarn install               # usa .yarn/cache (instalación offline)
cp .env.example .env       # valores por defecto compatibles con docker-compose

docker compose up -d       # postgres, mongo, adminer, mongo-express

yarn migrations:latest     # crea tablas events y tickets
yarn db:seed               # 100 eventos + 500 tickets/evento (repetible; ver H-16)

yarn start                 # nodemon + ts-node en http://localhost:3000
```

Verificación:

```bash
curl http://localhost:3000/health     # {"status":"ok"}
curl http://localhost:3000/events     # array de hasta 50 eventos con availableTickets
```

Herramientas de administración:

| Herramienta | URL | Credenciales |
|---|---|---|
| Adminer (PostgreSQL) | http://localhost:8080 | Sistema: PostgreSQL · Servidor: `db` · Usuario: `root` · Pass: `example` · BD: `seetickets` |
| mongo-express | http://localhost:8081 | (según versión puede pedir basic auth `admin`/`pass`) |

Otros comandos:

```bash
yarn migrations:make <nombre>   # nueva migración en src/database/migrations
yarn migrations:down            # revierte la última migración
yarn test                       # jest (requiere configurar ts-jest, ver §14)
docker compose down             # detiene los contenedores (sin volúmenes: se pierden datos)
```

### 17.3 Frontend

```bash
cd st-hiring-frontend
nvm use
yarn install
yarn dev            # http://localhost:5173 (proxy /events y /settings → :3000)
```

| Comando | Uso |
|---|---|
| `yarn build` | Type-check (`tsc -b`) + build de producción en `dist/` |
| `yarn preview` | Sirve `dist/` en http://localhost:4173 (sin proxy) |
| `yarn lint` | ESLint con `--max-warnings 0` |

> El backend debe estar en ejecución antes de usar el frontend.

### 17.4 Variables de entorno (backend)

| Variable | Default | Descripción |
|---|---|---|
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_USER` | `root` | Usuario |
| `DB_PASSWORD` | `example` | Contraseña |
| `DB_NAME` | `seetickets` | Base de datos |
| `MONGO_URI` | `mongodb://root:example@localhost:27017` | Conexión MongoDB (aún no usada) |
| `PORT` *(propuesta)* | `3000` | Puerto HTTP (hoy fijo en código) |

### 17.5 Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | Contenedor `db` no iniciado | `docker compose up -d` y esperar unos segundos |
| Seed falla con `value too long for type character varying(255)` | H-17 | Reintentar o cambiar `description` a `text` |
| Seed muy lento | H-16 (inserts uno a uno) | Usar inserts por lotes |
| `/events` tarda varios segundos | H-01/H-02/H-03 tras varios seeds | Aplicar correcciones de §16 |
| `yarn test` → "No tests found" | Sin tests ni config ts-jest | Ver §14 |
| Warning `version is obsolete` en compose | H-21 | Eliminar la clave `version` |

---

## 18. Arquitectura objetivo recomendada

### 18.1 Backend

```mermaid
flowchart TB
    subgraph HTTP
        R1[events.router] --> C1[getEventsController]
        R2[settings.router] --> C2[getSettingsController]
        R2 --> C3[upsertSettingsController]
        MW[validate · asyncHandler · errorHandler · notFound]
    end
    subgraph Servicios
        S1[EventsService<br/>paginación + disponibilidad]
        S2[SettingsService<br/>validación + defaults]
    end
    subgraph DAL
        D1[EventsDAL<br/>getEventsPage, countEvents]
        D2[TicketsDAL<br/>getAvailableByEventIds]
        D3[SettingsDAL<br/>get, upsert]
    end
    C1 --> S1 --> D1 & D2
    C2 & C3 --> S2 --> D3
    D1 & D2 --> PG[(PostgreSQL)]
    D3 --> MG[(MongoDB)]
```

Estructura sugerida (manteniendo los patrones existentes):

```
src/
├── app.ts                # createApp(deps): Express sin listen (testeable)
├── index.ts              # composition root + listen + graceful shutdown
├── config.ts             # lectura/validación de env
├── controllers/          # get-events.ts, get-settings.ts, upsert-settings.ts
├── dal/                  # events.dal.ts, tickets.dal.ts, settings.dal.ts
├── entity/               # event.ts, ticket.ts, settings.ts, pagination.ts
├── middleware/           # async-handler.ts, error-handler.ts, not-found.ts
└── **/*.test.ts
```

**Contrato de paginación propuesto**

```
GET /events?page=2&pageSize=20
```

```json
{
  "data": [
    { "id": 21, "name": "…", "date": "…", "location": "…", "description": "…",
      "availableTickets": 163, "createdAt": "…", "updatedAt": "…" }
  ],
  "pagination": { "page": 2, "pageSize": 20, "total": 300, "totalPages": 15 }
}
```

- Validación: `page ≥ 1`, `1 ≤ pageSize ≤ 100`, defaults `page=1`, `pageSize=20`; 400 si no son enteros.
- `ORDER BY date ASC, id ASC` para orden estable.
- `total` mediante `COUNT(*)` (ejecutado en paralelo con `Promise.all`).
- Disponibilidad con una sola query agregada:
  `SELECT event_id, COUNT(*) FROM tickets WHERE status='available' AND event_id = ANY(?) GROUP BY event_id`.
  Si el front necesita los tickets individuales, una sola query `whereIn` + agrupación en memoria.
- Alternativa futura: paginación por cursor (*keyset*) para tablas muy grandes.

**Settings (MongoDB)** — documento único (*singleton*):

```ts
interface Settings {
  _id: 'global';                 // id fijo → un solo documento
  currency: string;              // 'USD'
  timezone: string;              // 'America/New_York'
  defaultPageSize: number;       // 20
  maxTicketsPerOrder: number;    // 10
  notifications: { email: boolean; sms: boolean };
  updatedAt: Date;
}
```

- `GET /settings` → `findOne({ _id: 'global' })`; si no existe, devolver defaults (o 404, decisión a documentar).
- `POST /settings` → validar cuerpo y `findOneAndUpdate({ _id: 'global' }, { $set: {...body, updatedAt: new Date()} }, { upsert: true, returnDocument: 'after' })`.
- `MongoClient` creado una vez en el composition root e inyectado en `createSettingsDAL(db)`.

### 18.2 Frontend

```
src/
├── app/            store.ts, hooks.ts (useAppDispatch/useAppSelector), theme.ts
├── api/            client.ts (fetch wrapper), events.api.ts, settings.api.ts
├── features/
│   ├── events/     eventsSlice.ts (createAsyncThunk fetchEvents), EventsList.tsx, EventCard.tsx
│   └── settings/   settingsSlice.ts (fetch/save thunks), SettingsForm.tsx, settings.schema.ts (Yup)
├── components/     Layout.tsx (AppBar + Container)
├── test/           renderWithProviders.tsx, msw handlers
└── main.tsx        <Provider store> <ThemeProvider> <CssBaseline> <App/>
```

- Estado de eventos: `{ items, page, pageSize, total, totalPages, status: 'idle'|'loading'|'succeeded'|'failed', error }`.
- UI: `Grid` responsive de `Card`, `Pagination` + selector de `pageSize`, `Skeleton`/`CircularProgress`, `Alert` para errores.
- Settings: `Formik` con `initialValues` del store (`enableReinitialize`), `validationSchema` Yup, `TextField`/`Switch`/`Select` de MUI, `Snackbar` de confirmación.
- Alternativa a valorar: **RTK Query** para *fetching* y caché (cumple el requisito de Redux con menos código).

---

## 19. Riesgos y deuda técnica

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Degradación de `/events` con más seeds (N+1 + sin índices) | Alta | Alto | H-01..H-03, H-05 |
| Caídas silenciosas por errores async no manejados | Media | Alto | H-04 |
| Contrato JSON inconsistente (snake/camel) rompe el frontend al corregirlo | Media | Medio | Definir DTOs y mapear antes de construir el front |
| Ausencia de tests impide refactor seguro | Alta | Alto | §14 antes de refactorizar |
| Tooling roto (ESLint backend, flake) | Alta | Bajo | H-13, F-08 |
| Pérdida de datos locales al recrear contenedores | Media | Bajo | Volúmenes en compose |
| Sin Dockerfile ni CI | — | Medio | Dockerfiles multi-stage + GitHub Actions (lint, test, build) |

---

## 20. Glosario

| Término | Definición |
|---|---|
| **DAL** | *Data Access Layer*: capa que encapsula el acceso a la base de datos. |
| **N+1** | Antipatrón donde se ejecuta 1 consulta para obtener N registros y luego N consultas adicionales para sus relaciones. |
| **Composition Root** | Punto único de la aplicación donde se construyen y conectan las dependencias. |
| **HMR / Fast Refresh** | Reemplazo de módulos en caliente que actualiza componentes React sin perder estado. |
| **Upsert** | Operación que inserta si no existe o actualiza si existe. |
| **Slice** | Unidad de Redux Toolkit que agrupa estado, reducers y acciones de una feature. |
| **Thunk** | Función asíncrona despachable en Redux (`createAsyncThunk`). |
| **Keyset pagination** | Paginación basada en el último valor visto (cursor) en lugar de `OFFSET`. |
| **Seed** | Script que inserta datos de prueba en la base de datos. |
