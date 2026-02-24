# Phase 1: Infrastructure - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure the complete development environment: Express server with health check, PostgreSQL schema via Prisma for all conversation state, and Z-API webhook integration for WhatsApp message receiving. No message processing logic — just the foundation that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- Claude decides folder organization (user deferred)
- Naming convention: code in English, database tables/columns in Portuguese
- No linting tools for now (ESLint/Prettier deferred to later phase) — focus on shipping code

### Development Environment
- PostgreSQL hosted on **Supabase** (free tier, cloud-based)
- Tunnel tool: Claude decides (ngrok or cloudflared)
- Hosting for production: not decided yet — keep deployment-agnostic
- No Docker — database is cloud-hosted, app runs locally with ts-node-dev

### WhatsApp Provider
- **Z-API** as the sole WhatsApp provider (NOT Evolution API or Meta Cloud API)
- No multi-provider abstraction — Z-API only, simplify the code
- Phone numbers for dev/prod: user still needs to acquire — flag as a setup prerequisite
- Rate limiting approach: Claude decides (manual caution vs code-level limiter)

### Database Schema
- **Prisma** ORM with declarative schema and automatic migrations
- Message history: store ALL messages in database, send only last N to LLM at query time
- Quote state storage: Claude decides (JSONB vs structured table)
- Supabase as PostgreSQL provider — use standard connection string, no Supabase SDK

### Claude's Discretion
- Folder organization pattern (layered vs feature-based)
- Tunnel choice for dev (ngrok vs cloudflared)
- Rate limiting strategy for WhatsApp messages
- Quote state storage format (JSONB vs dedicated columns)
- Error handling patterns

</decisions>

<specifics>
## Specific Ideas

- Z-API is a Brazilian WhatsApp API provider — documentation is in Portuguese, webhook format differs from Evolution API and Meta API
- Supabase provides a standard PostgreSQL connection string — use it directly with Prisma, no Supabase client SDK needed
- Previous code exists as reference (TypeScript/Express pattern) but this is a clean rebuild
- The assessoria has 50+ brokers — schema should handle concurrent conversations from day one

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure*
*Context gathered: 2026-02-24*
