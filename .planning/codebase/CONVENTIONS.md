# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- Services: `[domain].service.ts` (e.g., `contact.service.ts`, `ai.service.ts`)
- Routes: `[domain].ts` (e.g., `webhook.ts`, `admin.ts`)
- Configuration: `config.ts`
- Database: `client.ts` in `db/` directory
- Types: `index.ts` in `types/` directory
- All lowercase with underscores for multi-word names in database-related contexts, kebab-case for routes/services

**Functions:**
- camelCase for all function names
- Descriptive, action-oriented names: `findContact()`, `upsertContact()`, `enrichMessage()`, `detectIntent()`
- Async functions prefixed with context when appropriate: `sendViaEvolutionApi()`, `sendViaMetaApi()`, `generateAIResponse()`
- Private/helper functions declared before their usage with no special prefix

**Variables:**
- camelCase for all variables
- Semantic naming: `enriched`, `existingContact`, `responseText`, `messageText`
- Boolean variables explicitly named to indicate state: `isNewContact`, `isHumanMode`, `atendimento_humano`
- Database fields use Portuguese snake_case: `telefone`, `atendimento_humano`, `ultimo_contexto`, `criado_em`, `atualizado_em`

**Types:**
- PascalCase for all type definitions and interfaces
- Interfaces prefixed with business domain: `ParsedMessage`, `Contact`, `EnrichedMessage`, `IntentResult`
- Union types use vertical bar: `type MessageType = 'text' | 'image' | 'document' | 'audio'`
- Enum-like unions for finite sets: `type ContactType = 'lead' | 'corretor' | 'cliente'`
- Database object mapping uses mixed Portuguese/English: `Contact` interface with Portuguese field names (`telefone`, `nome`)

## Code Style

**Formatting:**
- No explicit formatter configured (no .prettierrc, no ESLint config)
- Implicit style follows common TypeScript conventions:
  - 2-space indentation (observed in all files)
  - Trailing commas in multiline structures
  - Single quotes for strings throughout codebase
  - Long lines broken into multiple statements
  - Comments use `//` for single-line and `/* */` for block comments

**Linting:**
- TypeScript strict mode enabled via `tsconfig.json`
- Compiler options enforce strict null checks and consistent casing
- No ESLint or Prettier config present — style enforced by convention

**Line Length:**
- Typical limit around 100-120 characters observed
- Long function calls and type annotations broken across lines

## Import Organization

**Order:**
1. External packages (Express, OpenAI, axios, pg, etc.)
2. Relative imports from `../` or `./` (config, db, services, types)
3. No barrel imports except for types

**Path Aliases:**
- No path aliases configured in `tsconfig.json`
- All imports use relative paths: `../config`, `../types`, `../services/`

**Import Syntax:**
- Use ES6 `import` statements exclusively (no CommonJS `require`)
- Default imports for single exports: `import express from 'express'`
- Named imports for multiple exports: `import { db } from '../db/client'`
- Destructure parameters and responses

## Error Handling

**Patterns:**
- Try-catch used minimally; errors propagate up the call stack
- Async functions called with `.catch()` for background operations (see `webhook.ts` line 19):
  ```typescript
  processMessage(req.body).catch((err) => {
    console.error('[Webhook] Erro ao processar mensagem:', err?.message ?? err);
  });
  ```
- Database queries use typed generic: `db.query<Contact>(...)`
- No throw statements in most functions; null returns used for "not found" scenarios
- Safe property access using optional chaining: `result.rows[0] ?? null`
- Error messages include context prefix: `[DB]`, `[Webhook]`, `[Server]`, `[Admin]`

**Error Patterns:**
- Null coalescing (`??`) for safe defaults
- Logical OR (`||`) for fallback values in message parsing
- Optional chaining (`?.`) for nested object access in webhook parsing

## Logging

**Framework:** Node.js `console` module

**Patterns:**
- All logging uses `console.log()` for info, `console.error()` for errors
- Log messages prefixed with contextual labels in brackets: `[Server]`, `[DB]`, `[Webhook]`, `[Admin]`
- Used at startup: database connection confirmation, server port info
- Used in request processing: message received, intent detected, response sent
- Error logs include error message: `err?.message ?? err`

**When to Log:**
- Server startup and lifecycle events
- Database queries (connection status)
- Message processing flow (received, processed, sent)
- Background task completion/failure
- Command parsing and execution

## Comments

**When to Comment:**
- Comments used sparingly; code is mostly self-documenting
- Inline comments explain non-obvious logic: parsing logic in `parser.service.ts` explains webhook format detection
- Comments clarify business rules: FAQ entry keywords explained in `faq.service.ts`
- Comments mark process steps: `// 1. Parsear`, `// 2. Buscar/upsert contato` in webhook flow

**JSDoc/TSDoc:**
- Not used; TypeScript interfaces and explicit type annotations serve as documentation
- Function signatures are descriptive enough: `async function generateAIResponse(userMessage: string, contact: Contact, history: HistoryMessage[]): Promise<string>`

## Function Design

**Size:**
- Functions typically 15-40 lines
- Long functions refactored into multiple smaller functions: `webhook.ts` `processMessage()` function (108 lines) orchestrates smaller service functions
- Service functions focus on single responsibility: `findContact()`, `enrichMessage()`, `detectIntent()` each do one thing

**Parameters:**
- Limit 3-4 parameters per function
- Destructuring used in route handlers: `const { humanDelayMinMs, humanDelayMaxMs } = config.app`
- Complex parameters passed as objects with typed interfaces

**Return Values:**
- Typed return statements: `Promise<void>`, `Promise<Contact | null>`, `Promise<string>`
- Consistent null return for "not found": `return result.rows[0] ?? null`
- Union types for functions with multiple outcomes: `Intent` type represents intentional outcomes

**Async/Await:**
- All database operations are async
- All HTTP calls (OpenAI, WhatsApp APIs) are async
- `async function` used throughout; no Promise chains
- `.catch()` used for non-blocking background operations

## Module Design

**Exports:**
- Services export multiple named functions: `contact.service.ts` exports `findContact`, `upsertContact`, `enrichMessage`, `setHumanMode`
- Each file focused on single domain: `contact.service.ts` for contact operations, `ai.service.ts` for OpenAI integration
- Configuration exported as single named object: `export const config = {...}`

**Barrel Files:**
- Used sparingly; main type exports in `types/index.ts`
- Routes exported as default: `export default router`
- Services rely on relative imports, not barrels

## Database Conventions

**Query Style:**
- Parameterized queries using `$1`, `$2` placeholders (PostgreSQL)
- Type-generic queries: `db.query<Contact>(...)` for typed results
- SQL formatted across multiple lines for readability
- Field names in queries match Portuguese database schema

**Field Naming:**
- Database: snake_case (telefone, atendimento_humano, criado_em)
- TypeScript interfaces: Match database exactly or use camelCase depending on context
- Mapping: `Contact` interface uses Portuguese field names to match schema

## Configuration

**Pattern:**
- Centralized in `config.ts`
- Helper functions: `required()` throws if env var missing, `optional()` returns default
- Grouped by domain: `database`, `openai`, `whatsapp`, `team`, `app`
- All environment variables read once at startup

---

*Convention analysis: 2026-02-23*
