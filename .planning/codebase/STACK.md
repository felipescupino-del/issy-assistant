# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.6.3 - All source code (`src/**/*.ts`)
- SQL (PostgreSQL) - Database migrations and triggers (`src/db/migrations/*.sql`)

**Secondary:**
- JavaScript (Node.js runtime compiled from TypeScript)

## Runtime

**Environment:**
- Node.js 24.13.1 (LTS)

**Package Manager:**
- npm 11.8.0
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express.js 4.21.1 - HTTP server framework for webhook endpoints and admin API (`src/index.ts`, `src/routes/`)
- OpenAI SDK 4.67.0 - AI chat completions and system prompts (`src/services/ai.service.ts`)

**Testing:**
- Not detected

**Build/Dev:**
- TypeScript 5.6.3 - Compilation (`tsconfig.json` → `dist/`)
- ts-node-dev 2.0.0 - Development server with auto-respawn (`npm run dev`)

## Key Dependencies

**Critical:**
- `pg` 8.13.0 - PostgreSQL connection pool and query execution (`src/db/client.ts`)
- `openai` 4.67.0 - OpenAI API client for GPT-4o-mini completions with system prompt building
- `axios` 1.7.7 - HTTP client for external APIs (Evolution API and Meta Cloud API) (`src/services/whatsapp.service.ts`)

**Infrastructure:**
- `express` 4.21.1 - REST endpoint framework
- `dotenv` 16.4.5 - Environment variable management (`src/config.ts`)

**Dev Dependencies:**
- `@types/node` 22.7.7 - Node.js type definitions
- `@types/express` 5.0.0 - Express type definitions
- `@types/pg` 8.11.10 - PostgreSQL client type definitions

## Configuration

**Environment:**
- Loaded via `dotenv` in `src/config.ts`
- Critical environment variables:
  - `DATABASE_URL` - PostgreSQL connection string (required)
  - `OPENAI_API_KEY` - OpenAI API key (required)
  - `PORT` - Server port (default: 3000)
  - `WHATSAPP_PROVIDER` - "evolution" or "meta" (default: evolution)
  - `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` - Evolution API credentials
  - `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID` - Meta Cloud API credentials
  - `TEAM_NOTIFICATION_NUMBER` - Team notification phone number (optional)
  - `OPENAI_MODEL` - Model name (default: gpt-4o-mini)
  - `OPENAI_TEMPERATURE` - Model temperature (default: 0.85)
  - `OPENAI_MAX_TOKENS` - Max tokens per response (default: 500)
  - `HUMAN_DELAY_MIN_MS`, `HUMAN_DELAY_MAX_MS` - Humanization delays (defaults: 1500, 8000)
  - `HISTORY_LIMIT` - Message history window (default: 20)

**Build:**
- TypeScript compiler config: `tsconfig.json`
  - Target: ES2020
  - Module: commonjs
  - Output directory: `dist/`
  - Source directory: `src/`
  - Strict mode: enabled
  - JSON module resolution: enabled

## Platform Requirements

**Development:**
- Node.js 24.13.1+ (or compatible LTS version)
- npm 11.8.0+
- PostgreSQL 12+ (for database connection)
- macOS/Linux/Windows (cross-platform support via Node.js)

**Production:**
- Node.js 24.13.1+ LTS
- PostgreSQL 12+ (remote or containerized)
- Environment variables configured (DATABASE_URL, OPENAI_API_KEY, etc.)
- Port 3000 exposed (configurable via PORT env var)

---

*Stack analysis: 2026-02-23*
