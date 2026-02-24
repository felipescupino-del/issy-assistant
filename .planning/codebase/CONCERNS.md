# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Unsafe Type Assertions Throughout Parser:**
- Issue: Extensive use of `as` type assertions without validation in webhook payload parsing
- Files: `src/services/parser.service.ts` (lines 10-78)
- Impact: If WhatsApp API changes payload structure or attacker sends malformed data, parsing will fail silently with undefined values, causing null pointer exceptions downstream
- Fix approach: Implement proper schema validation using zod or similar library; add runtime type guards before assertions

**Fire-and-Forget Background Processing:**
- Issue: Webhook handler responds immediately then processes message in background without error tracking
- Files: `src/routes/webhook.ts` (lines 14-21)
- Impact: Failed message processing is only logged to console; no retry mechanism, no dead letter queue, no monitoring of processing failures
- Fix approach: Implement proper async job queue (Bull, RabbitMQ) with retry logic and failure callbacks

**Hardcoded FAQ and Intent Patterns:**
- Issue: All FAQ entries and intent detection patterns are static strings in code
- Files: `src/services/faq.service.ts` (lines 1-59), `src/services/intent.service.ts` (lines 3-30)
- Impact: Cannot update responses or add new intents without code deployment; difficult to A/B test messaging
- Fix approach: Move FAQ and patterns to database with admin interface for updates

**No Input Validation Layer:**
- Issue: User input (phone numbers, messages) only gets basic regex cleaning, no length/content validation
- Files: `src/services/parser.service.ts` (line 81), `src/routes/webhook.ts` (line 28)
- Impact: Potential for exploitation; very long messages could exhaust OpenAI token limits or database; no protection against prompt injection
- Fix approach: Add input validation middleware; implement rate limiting per phone number; add message length caps

**Manual Configuration Parsing Without Validation:**
- Issue: Config parsing uses optional() with string defaults that are later parsed to numbers/floats without error handling
- Files: `src/config.ts` (lines 10-12, 24-25)
- Impact: If invalid values provided (e.g., PORT="abc"), parseInt will return NaN silently, causing server startup to fail in production
- Fix approach: Use zod or similar for config schema validation; fail fast with clear error messages

---

## Known Bugs

**Floating Promises in Webhook Handler:**
- Symptoms: Errors during message processing (AI API calls, database queries) silently logged; caller has no indication of failure
- Files: `src/routes/webhook.ts` (lines 19-21, 54, 85)
- Trigger: Any unhandled rejection in processMessage() or nested .catch(() => null) calls
- Workaround: Check application logs for [Webhook] error messages

**Incomplete Contact Enrichment Logic:**
- Symptoms: When contact doesn't exist, enrichMessage() builds local Contact object missing database-assigned ID
- Files: `src/services/contact.service.ts` (lines 42-49) combined with `src/routes/webhook.ts` (line 36)
- Trigger: New contact messages when upsertContact() completes but enrichMessage uses stale null reference
- Workaround: None; ID will be undefined in EnrichedMessage

**Race Condition in Contact Upsert:**
- Symptoms: Two messages from same new contact arriving simultaneously may both execute upsertContact, causing duplicate key violations
- Files: `src/services/contact.service.ts` (lines 12-23)
- Trigger: High-frequency messages from new contacts
- Workaround: Requires database-level duplicate handling (ON CONFLICT clause handles it, but logging doesn't distinguish success from conflict)

**History Query Ordering Error:**
- Symptoms: Message history sometimes appears reversed chronologically in AI context
- Files: `src/services/history.service.ts` (lines 5-16)
- Trigger: Queries LIMIT before ORDER; fetches last N messages, then reverses order, producing correct sequence only if exactly N messages exist
- Workaround: Works correctly but fragile; any change to history retrieval logic breaks this

---

## Security Considerations

**No Authentication on Admin Endpoint:**
- Risk: `/whatsapp-admin` endpoint accepts any POST request without authentication; attacker can freely toggle human mode or query contact info
- Files: `src/routes/admin.ts` (entire file), `src/index.ts` (line 19)
- Current mitigation: None (relies on URL obscurity)
- Recommendations:
  - Add API key validation header check
  - Implement IP whitelist if running behind corporate network
  - Add request signing with HMAC
  - Rate limit admin endpoint

**OpenAI API Key Exposed in Config:**
- Risk: OPENAI_API_KEY stored in environment variable; if process memory dumped or logs captured, key is compromised
- Files: `src/config.ts` (line 22), `.env.example` (line 14)
- Current mitigation: Only in environment variables (not in code), but used directly in every AI call
- Recommendations:
  - Use OpenAI API key rotation
  - Set per-endpoint rate limits in OpenAI console
  - Consider proxying AI calls through internal auth server
  - Monitor API key usage for anomalies

**No Validation of Incoming Webhook Structure:**
- Risk: Arbitrary JSON accepted; parser handles multiple formats but no schema enforcement; could accept malicious payloads
- Files: `src/routes/webhook.ts` (line 14), `src/services/parser.service.ts` (lines 10-78)
- Current mitigation: Unknown format falls through to generic extraction attempts
- Recommendations:
  - Add request signature verification from WhatsApp provider
  - Implement strict schema validation for expected formats
  - Log all unknown formats for review

**Message Content Not Sanitized Before Logging:**
- Risk: User messages logged verbatim; could contain PII that appears in application logs
- Files: `src/routes/webhook.ts` (lines 33, 123, 128)
- Current mitigation: Only logged to console/file, no centralized sensitive log handling
- Recommendations:
  - Redact user message content from logs (log hash or message length only)
  - Implement log encryption
  - Set retention policies for sensitive logs

**No Rate Limiting:**
- Risk: Single phone number can spam unlimited messages, consuming AI API quota and database resources
- Files: Entire webhook processing pipeline
- Current mitigation: None
- Recommendations:
  - Implement per-phone rate limiting (e.g., max 10 messages/minute)
  - Add exponential backoff for repeated contacts
  - Track and alert on unusual activity patterns

---

## Performance Bottlenecks

**Synchronous AI API Calls Block Event Loop:**
- Problem: Each webhook request waits for OpenAI completion (could be 2-5 seconds per message)
- Files: `src/services/ai.service.ts` (line 67), `src/routes/webhook.ts` (lines 100-117)
- Cause: Using `await` on HTTP request without concurrency limits or timeouts
- Improvement path:
  - Add request timeout (currently none visible)
  - Implement circuit breaker for AI API failures
  - Cache common response patterns to reduce AI calls
  - Batch process messages if possible

**Full Message History Loaded Per Request:**
- Problem: Every conversation loads entire history (configurable, default 20 messages) from database
- Files: `src/services/history.service.ts` (lines 5-16)
- Cause: No caching; no summarization of old conversations
- Improvement path:
  - Add in-memory conversation cache with TTL
  - Implement message summarization for conversations > 50 messages
  - Use database query optimization (index already exists but no pagination)

**Random Delay Calculation Inefficient:**
- Problem: Unused Math.random() call on every message send
- Files: `src/services/whatsapp.service.ts` (line 64)
- Cause: calculateHumanDelay() does floating-point multiplication and Math.round on every call
- Improvement path: Pre-compute variation calculation or cache results

**No Database Connection Pooling Tuning:**
- Problem: Pool size fixed at 10; may be undersized for concurrent message load
- Files: `src/db/client.ts` (line 6)
- Cause: Default max=10 connections; no monitoring of queue depth
- Improvement path:
  - Monitor active queries vs pool size
  - Consider increasing max to 20-30 for production
  - Add query performance monitoring

---

## Fragile Areas

**Parser Service Message Extraction:**
- Files: `src/services/parser.service.ts` (lines 3-90)
- Why fragile: Supports 3 different webhook formats (Evolution, Meta, generic fallback); any API change breaks extraction; type assertions bypass TypeScript safety
- Safe modification:
  - Add test cases for each format
  - Implement schema validation before type assertions
  - Add integration tests with real webhook samples
- Test coverage: No test files detected; zero coverage

**Intent Detection with Simple String Matching:**
- Files: `src/services/intent.service.ts` (lines 32-52)
- Why fragile: Case-sensitive keywords in patterns; patterns can overlap causing unpredictable matches; no confidence scoring
- Safe modification:
  - Add priority ordering to intent detection
  - Implement confidence threshold
  - Add test cases for edge cases
- Test coverage: No test files detected

**AI System Prompt Hardcoded:**
- Files: `src/services/ai.service.ts` (lines 7-53)
- Why fragile: 780-character prompt generated fresh per request; any change requires code edit; no versioning
- Safe modification:
  - Move to config/database
  - Add system prompt versioning
  - Test prompt changes before deploying
- Test coverage: No test files

**Contact Service Null Handling:**
- Files: `src/services/contact.service.ts` (lines 35-69)
- Why fragile: enrichMessage() creates partial Contact object if new; downstream code assumes id exists; no null checks
- Safe modification:
  - Refactor to load contact immediately after upsert
  - Add explicit type for new vs existing contacts
- Test coverage: No tests

**Admin Route Command Parsing:**
- Files: `src/routes/admin.ts` (lines 51-71)
- Why fragile: String.replace() based parsing; no error handling for malformed commands; case-sensitive
- Safe modification:
  - Use regex with capture groups
  - Add comprehensive test cases
  - Implement stricter validation
- Test coverage: No test files

---

## Scaling Limits

**Single Pool Database Connection Limit:**
- Current capacity: 10 concurrent connections
- Limit: Beyond 10 concurrent requests with database access, requests queue; if queue exceeds capacity, connections timeout
- Scaling path: Increase pool size; implement read replicas; add connection pooler (PgBouncer)

**In-Memory Configuration Loading:**
- Current capacity: Config loaded once at startup
- Limit: Cannot hot-reload config changes; must restart server
- Scaling path: Implement config service with periodic polling; use feature flags system

**No Message Queue:**
- Current capacity: Server can only process messages as fast as they arrive + AI response time
- Limit: High-traffic periods will cause webhook timeouts; no backpressure handling
- Scaling path: Add Bull/RabbitMQ queue with workers; implement graceful degradation

**Single Server Instance:**
- Current capacity: Single Node.js process with single event loop
- Limit: CPU-bound tasks block; no horizontal scaling
- Scaling path: Deploy multiple instances behind load balancer; use PM2 or Docker for process management

---

## Dependencies at Risk

**axios ^1.7.7 - No Version Lock:**
- Risk: Minor version updates could introduce breaking changes; no lockfile strategy defined
- Impact: Upstream API calls fail silently if axios behavior changes
- Migration plan: Lock to specific version; implement automated dependency update testing in CI

**pg ^8.13.0 - Database Driver:**
- Risk: PostgreSQL connection issues unhandled; pool error handler only logs (line 11-13 in db/client.ts)
- Impact: Database disconnections not propagated to application; requests silently fail
- Migration plan: Add connection state monitoring; implement health checks; add automatic reconnection

**OpenAI API Version Pinned But Hard to Update:**
- Risk: API version in code (v20.0 hardcoded in whatsapp.service.ts line 28)
- Impact: When Meta API versions deprecate, code breaks
- Migration plan: Move API version to config; implement version negotiation

---

## Missing Critical Features

**No Logging/Observability:**
- Problem: Only console.log used; no structured logging, no log aggregation, no monitoring
- Blocks: Cannot debug production issues; no visibility into error rates; no performance metrics
- Impact: When production fails, investigation is manual and time-consuming

**No Error Recovery/Retry Logic:**
- Problem: Failed API calls (WhatsApp send, OpenAI, database) fail immediately
- Blocks: Transient failures (network glitch, API timeout) cause lost messages
- Impact: Message delivery unreliable; user experience poor during network issues

**No Message Idempotency:**
- Problem: If webhook called twice with same message, message processes twice
- Blocks: Cannot safely implement retries; duplicate messages sent to users
- Impact: Potential for duplicate responses; poor user experience

**No API Rate Limiting:**
- Problem: No limit on messages per phone number; no throttling
- Blocks: System vulnerable to abuse; no cost control; bot can be DOSed
- Impact: Resource exhaustion; unexpected costs

**No Database Migrations Management:**
- Problem: Manual SQL file in repo; no version tracking; no rollback capability
- Blocks: Cannot safely update schema in production; difficult multi-environment deployments
- Impact: Schema changes are risky; downtimes required

**No Testing Framework:**
- Problem: Zero test files found; no test infrastructure
- Blocks: Cannot safely refactor; no regression detection; no confidence in changes
- Impact: High change risk; bugs slip to production easily

**No Health/Readiness Checks:**
- Problem: /health endpoint only returns fixed 'ok'; doesn't check database connectivity
- Blocks: Load balancer cannot detect unhealthy instances; will route traffic to broken servers
- Impact: Partial outages appear as full outages; traffic sent to broken instances

---

## Test Coverage Gaps

**Parser Service - Zero Coverage:**
- What's not tested: All three webhook format parsers; error cases; malformed payloads
- Files: `src/services/parser.service.ts`
- Risk: Parser bugs won't be caught; format changes undetected until production
- Priority: **High** - critical path

**AI Service - Zero Coverage:**
- What's not tested: System prompt generation; API error handling; token limit edge cases
- Files: `src/services/ai.service.ts`
- Risk: Prompt injection undetected; API failures cause silent failures
- Priority: **High** - directly impacts user experience

**Webhook Route Handler - Zero Coverage:**
- What's not tested: Message processing flow; intent detection; response generation
- Files: `src/routes/webhook.ts`
- Risk: Main business logic untested; integration failures undetected
- Priority: **High** - entire feature is untested

**Admin Route - Zero Coverage:**
- What's not tested: Command parsing; authentication bypass; edge cases
- Files: `src/routes/admin.ts`
- Risk: Security issues undetected; admin commands fail silently
- Priority: **Medium** - but has security implications

**Database Services - Zero Coverage:**
- What's not tested: Query execution; error handling; data consistency
- Files: `src/services/contact.service.ts`, `src/services/history.service.ts`
- Risk: Data corruption undetected; concurrency issues missed
- Priority: **High** - data integrity critical

**Configuration - Zero Coverage:**
- What's not tested: Environment variable loading; defaults; type conversions
- Files: `src/config.ts`
- Risk: Configuration errors not caught at startup; failures in production
- Priority: **Medium** - catches startup issues

---

*Concerns audit: 2026-02-23*
