# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Status:** Not detected

No testing framework is configured in this codebase. The `package.json` contains no test runner (Jest, Vitest, Mocha), no assertion libraries (Chai, Expect), and no test scripts. No test files (`.test.ts`, `.spec.ts`) exist in the `src/` directory.

**Development Approach:**
- Manual testing via local dev server: `npm run dev`
- TypeScript strict mode provides some type safety
- No automated unit, integration, or E2E tests

## Test File Organization

**Current State:** Not applicable — no tests exist

**If tests were added, recommended pattern:**
- Co-located with source: `contact.service.ts` would have `contact.service.test.ts` in same directory
- Naming: `[feature].test.ts` for test files
- Group by service domain

## Test Structure

**Recommended Pattern (if tests were implemented):**

```typescript
describe('ContactService', () => {
  describe('findContact', () => {
    it('should return contact by phone number', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should return null if contact not found', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Mocking

**Current State:** Not applicable — no mocking library configured

**If mocking were needed (recommended approach):**
- Mock database: `db.query` would be mocked to return test data
- Mock external APIs: OpenAI, Evolution API, Meta WhatsApp API calls would be mocked
- Mock Express requests/responses in route testing
- Jest or Vitest would provide built-in mocking capabilities

**Dependencies to mock if testing were implemented:**
```typescript
// Example mocking pattern
jest.mock('../db/client');
jest.mock('../config');
jest.mock('openai');
jest.mock('axios');
```

## Fixtures and Factories

**Current State:** Not detected

**Recommended if tests were added:**

Test data would need fixtures for:
- Contact objects matching `Contact` interface
- Message objects matching `ParsedMessage` interface
- Configuration objects
- Database query responses
- API responses from OpenAI and WhatsApp providers

**Example fixture location:**
```
src/__fixtures__/
├── contacts.fixture.ts
├── messages.fixture.ts
└── responses.fixture.ts
```

**Example fixture pattern:**
```typescript
// contacts.fixture.ts
export const mockContact: Contact = {
  id: 1,
  telefone: '5511999999999',
  nome: 'João Silva',
  tipo: 'lead',
  atendimento_humano: false,
  criado_em: '2026-02-23T10:00:00Z',
  atualizado_em: '2026-02-23T10:00:00Z',
};
```

## Coverage

**Requirements:** None enforced

No coverage threshold configured. No coverage reports generated.

**If coverage were desired:**
- Target would typically be 80%+ for services
- Routes might have lower coverage requirements due to Express boilerplate
- External API integrations would require mocking for testable coverage

## Test Types

**Unit Tests (if implemented):**
- Test individual service functions: `findContact()`, `enrichMessage()`, `detectIntent()`
- Mock database and external dependencies
- Scope: Single function or tightly coupled functions
- Location: `src/services/[domain].service.test.ts`

**Integration Tests (if implemented):**
- Test full message processing pipeline: `processMessage()` function in `webhook.ts`
- Mock only external APIs (OpenAI, WhatsApp), test database integration
- Scope: Service interactions, database operations, orchestration logic
- Location: `src/routes/webhook.test.ts`

**E2E Tests (if implemented):**
- Test full webhook request to WhatsApp response
- Mock external APIs only
- Start actual Express server
- Scope: Complete user workflow
- Framework: Supertest or similar
- Location: `src/__e2e__/webhook.e2e.test.ts`

## Common Patterns

**Async Testing:**
Currently not tested, but if testing were implemented:

```typescript
// Jest/Vitest pattern
describe('async operations', () => {
  it('should load contact history', async () => {
    // Must return Promise for proper async handling
    const result = await loadHistory('5511999999999');
    expect(result).toEqual([...]);
  });
});
```

All service functions use async/await, so tests would need to handle Promises.

**Error Testing:**
No error testing currently implemented. If added:

```typescript
it('should handle database connection errors', async () => {
  // Mock db.query to throw error
  jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('Connection failed'));

  // Test should verify error handling
  await expect(findContact('5511999999999')).rejects.toThrow();
});
```

**Database Testing:**
No database tests exist. If added, would use:
- Test database (separate PostgreSQL instance)
- Or mock `pg` package entirely
- Transactions to rollback test data

## Run Commands

**If test framework were added (example with Jest):**

```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
npm run test:unit        # Run only unit tests
npm run test:integration # Run integration tests
```

## Manual Testing Approach (Current State)

**Development Testing:**
1. Start dev server: `npm run dev`
2. Send test messages to webhook
3. Monitor console logs with context prefixes: `[Webhook]`, `[DB]`, `[Server]`
4. Verify WhatsApp message responses manually

**Testing Checklist (Manual):**
- [ ] Message parsing: Different webhook formats (Evolution vs Meta)
- [ ] Contact lookup: New vs existing contacts
- [ ] Intent detection: Each intent type (greeting, quote, FAQ, transfer)
- [ ] FAQ matching: Keyword matching for FAQ entries
- [ ] AI response: OpenAI integration and history loading
- [ ] Human mode: Switching between bot and human mode
- [ ] Admin commands: `/bot` and `/status` commands
- [ ] Error handling: Graceful failure on API timeouts, connection errors

## Recommended Testing Strategy

**Priority order if implementing tests:**

1. **High priority:** Service functions in `contact.service.ts`, `intent.service.ts`, `parser.service.ts`
   - These are pure logic with predictable inputs/outputs
   - Easy to test with fixtures

2. **Medium priority:** AI and quote building in `ai.service.ts`, `quote.service.ts`, `faq.service.ts`
   - Require mocking external APIs
   - Test pattern matching and response selection

3. **Medium priority:** Message flow in `webhook.ts`
   - Integration test for entire pipeline
   - Uses database mock and API mocks

4. **Lower priority:** Admin route (`admin.ts`)
   - Requires database mock
   - Command parsing is testable separately

## Code Testability Observations

**Strengths for future testing:**
- Functions are small and focused (good testability)
- Pure functions for parsing and intent detection (no side effects)
- Clear separation of concerns (services vs routes)
- Typed parameters and returns (fixtures are well-defined)

**Challenges for future testing:**
- Heavy database dependency in most services
- Multiple external API calls (OpenAI, WhatsApp providers)
- Configuration loaded from environment
- No dependency injection; direct imports of singletons

**Improvement recommendations:**
- Extract parsing logic into pure functions (partially done in `parser.service.ts`)
- Inject database client for better mockability
- Extract configuration into injectable service
- Use middleware pattern for request logging rather than inline console.log

---

*Testing analysis: 2026-02-23*
