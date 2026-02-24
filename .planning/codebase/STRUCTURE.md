# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
issy-assistant/
├── src/                               # TypeScript source code
│   ├── index.ts                       # Express app entry point
│   ├── config.ts                      # Environment config + validation
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces (Message, Contact, Intent, etc)
│   ├── db/
│   │   ├── client.ts                  # PostgreSQL Pool instance
│   │   └── migrations/
│   │       └── 001_initial.sql        # Schema: contatos, historico_mensagens tables
│   ├── routes/
│   │   ├── webhook.ts                 # POST /whatsapp-webhook handler
│   │   └── admin.ts                   # POST /whatsapp-admin handler
│   └── services/                      # Business logic (pure functions + async)
│       ├── parser.service.ts          # Parse Evolution API / Meta API / generic JSON
│       ├── contact.service.ts         # CRUD: findContact, upsertContact, setHumanMode
│       ├── intent.service.ts          # Pattern matching → detect intent
│       ├── faq.service.ts             # Keyword-based FAQ lookup
│       ├── quote.service.ts           # Insurance type detection + quote prompt
│       ├── ai.service.ts              # OpenAI Chat Completions call
│       ├── history.service.ts         # Load/save conversation history from DB
│       └── whatsapp.service.ts        # Send via Evolution or Meta API + delay calc
├── dist/                              # Compiled JavaScript (after `npm run build`)
├── node_modules/                      # Dependencies
├── package.json                       # Project metadata + npm scripts
├── package-lock.json                  # Locked dependency versions
├── tsconfig.json                      # TypeScript compiler config
├── .env.example                       # Example environment variables
├── .env                               # Local environment (git ignored)
└── README.md                          # Project documentation

```

## Directory Purposes

**src/**
- Purpose: All TypeScript source code
- Contains: Route handlers, services, database client, types, config
- Key files: `index.ts` (entry point), `config.ts` (validation)

**src/routes/**
- Purpose: Express route handlers for HTTP endpoints
- Contains: Webhook handler (`POST /whatsapp-webhook`), admin handler (`POST /whatsapp-admin`)
- Key files: `webhook.ts` (main message processing), `admin.ts` (team commands)

**src/services/**
- Purpose: Business logic functions (message parsing, intent detection, API calls)
- Contains: 8 domain-specific service modules
- Key files: `parser.service.ts` (webhook adapter), `ai.service.ts` (OpenAI integration), `intent.service.ts` (routing logic)

**src/db/**
- Purpose: Database access and migrations
- Contains: PostgreSQL Pool configuration, SQL schema
- Key files: `client.ts` (connection), `migrations/001_initial.sql` (schema)

**src/types/**
- Purpose: TypeScript interfaces and types
- Contains: Single `index.ts` with all type definitions
- Key files: `index.ts` (Contact, ParsedMessage, Intent, etc)

**dist/**
- Purpose: Compiled JavaScript output
- Contains: Generated .js files (ignore from git)
- Generated: Yes (`npm run build`)
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `src/index.ts`: Server startup, Express app creation, route registration

**Configuration:**
- `src/config.ts`: Environment variable loading and validation
- `tsconfig.json`: TypeScript compilation settings

**Core Logic:**
- `src/routes/webhook.ts`: Main message processing orchestration
- `src/services/intent.service.ts`: Intent routing via keyword patterns
- `src/services/ai.service.ts`: OpenAI integration with system prompt

**Testing:**
- No test files present (testing not yet implemented)

## Naming Conventions

**Files:**
- `*.service.ts`: Service layer functions (one file per domain: parser, contact, intent, faq, quote, ai, history, whatsapp)
- `*.ts`: TypeScript files (no .js)
- Routes: `webhook.ts`, `admin.ts` (named by endpoint purpose)

**Directories:**
- `routes/`: Endpoint handlers
- `services/`: Business logic
- `db/`: Database access
- `types/`: Type definitions
- `migrations/`: SQL scripts

**Functions:**
- camelCase: `parseMessage()`, `detectIntent()`, `findContact()`, `generateAIResponse()`
- Verb-first for actions: `send*`, `load*`, `save*`, `find*`, `set*`, `build*`
- PascalCase: Type names (`Contact`, `ParsedMessage`, `EnrichedMessage`, `IntentResult`)

**Variables:**
- camelCase throughout: `phoneNumber`, `messageText`, `senderName`, `responseText`, `enriched`, `withIntent`
- Prefixed booleans: `isNewContact`, `isHumanMode`, `atendimento_humano` (in DB)
- Database fields: snake_case (PostgreSQL convention): `telefone`, `criado_em`, `atualizado_em`, `atendimento_humano`

**Types:**
- Union types: `Intent = 'saudacao' | 'cotacao' | 'faq' | 'transferir_humano' | 'conversa_geral'`
- Record types: `PATTERNS: Record<Intent, string[]>` for intent pattern mapping
- Interfaces: `export interface ParsedMessage { phoneNumber: string; ... }`

## Where to Add New Code

**New Feature (e.g., new intent type):**
- Primary code: `src/services/intent.service.ts` (add pattern to `PATTERNS` object)
- Secondary: `src/routes/webhook.ts` (add case branch in intent switch statement)
- Logic: `src/services/<new-service>.ts` (if feature requires dedicated service)
- Tests: `src/services/<new-service>.test.ts` (follow pattern if tests added)

**New Component/Module (e.g., payment integration):**
- Implementation: `src/services/payment.service.ts` (or similar)
- Types: Update `src/types/index.ts` with new interfaces
- Route: Add new route file if it handles HTTP requests: `src/routes/payment.ts`
- Config: Add new env vars to `src/config.ts` if needed

**Utilities (e.g., string formatting, date helpers):**
- Shared helpers: Create `src/services/utils.service.ts` or similar
- Single-use: Inline in service where used
- Database queries: Use existing patterns in `history.service.ts` and `contact.service.ts` as reference

**Database Schema Changes:**
- Location: `src/db/migrations/`
- Naming: `002_feature_name.sql` (incrementing number)
- Execution: `psql $DATABASE_URL -f src/db/migrations/002_feature_name.sql`
- TypeScript types: Update `src/types/index.ts` to reflect schema changes

**Tests (when implemented):**
- Unit tests: Co-located with service files, e.g., `src/services/parser.service.test.ts`
- Pattern: Jest/Vitest (if configured later)
- Coverage: Aim to test service functions before route integration

## Special Directories

**node_modules/:**
- Purpose: npm installed dependencies
- Generated: Yes (`npm install`)
- Committed: No (in .gitignore)

**dist/:**
- Purpose: TypeScript compiled output
- Generated: Yes (`npm run build`)
- Committed: No (in .gitignore)

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc)
- Generated: Yes (by gsd:map-codebase command)
- Committed: Yes (version control)

---

*Structure analysis: 2026-02-23*
