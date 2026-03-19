---
name: add-tests
description: >
  Add tests to a project or module. Handles test framework setup, test planning, and test
  implementation. Use when: "add tests", "write tests", "set up testing", "test this",
  "we need tests for", "create test suite", or when a new module/library has no tests.
  Covers JS/TS projects (Vitest, Jest) and React component testing (@testing-library/react).
---

# Add Tests

## Workflow

### 1. Detect existing setup

Check for existing test infrastructure before adding anything:
- Look for `vitest`, `jest`, or `mocha` in `package.json` devDependencies
- Check for `vite.config.*` or `vitest.config.*` with `test` config
- Look for existing test files (`*.test.*`, `*.spec.*`, `__tests__/`)
- Check for a test setup file (`test-setup.*`, `setupTests.*`)

If tests already exist, match the existing patterns (framework, file naming, location, style).

### 2. Set up framework (if needed)

**Prefer Vitest** for Vite-based projects. Prefer Jest only if already in use.

Minimal setup for Vitest + React:

```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Add to `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
// ... inside defineConfig:
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./src/test-setup.ts"],
},
```

Create `src/test-setup.ts`:
```ts
import "@testing-library/jest-dom"
```

Add scripts to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### 3. Plan tests

Before writing, categorize every module by risk and testability:

| Risk | Testability | Action |
|---|---|---|
| High | Easy (pure functions) | Thorough unit tests with edge cases |
| High | Hard (needs DOM/framework) | Integration tests with real instances |
| Medium | Easy | Behavioral tests |
| Low | Any | Skip or minimal smoke test |

Identify what to NOT test — see [references/philosophy.md](references/philosophy.md).

Ask the user to confirm the plan before writing tests.

### 4. Write tests

**Co-locate tests** next to source files: `foo.ts` → `foo.test.ts`.

Follow these patterns by code type:

**Pure functions:** Test input/output exhaustively.
```ts
it("handles normal input", () => { ... })
it("handles empty input", () => { ... })
it("handles boundary values", () => { ... })
it("round-trips correctly", () => { ... })
```

**React components:** Test behavior, not structure. Query by role/text/placeholder.
```tsx
it("calls onSubmit with form data when submitted", async () => {
  const onSubmit = vi.fn()
  render(<Form onSubmit={onSubmit} />)
  await userEvent.type(screen.getByPlaceholderText("Name"), "Alice")
  fireEvent.click(screen.getByText("Submit"))
  expect(onSubmit).toHaveBeenCalledWith({ name: "Alice" })
})
```

**Framework integrations (CM6, Redux, etc.):** Use real instances, not mocks.
```ts
const state = EditorState.create({ doc: "hello", extensions: [myField] })
state = state.update({ effects: myEffect.of(value) }).state
expect(getResult(state)).toEqual(expected)
```

### 5. Run and fix

Run the full suite, fix failures, re-run until green. Only then present results to user.

## Key principles

- Test the contract, not the implementation
- No snapshot tests
- Mock only external boundaries (network, filesystem), never internal modules
- ~80% coverage is fine; don't chase 100%
- Skip tests for code that can't be meaningfully tested in jsdom (layout, coordinates, scroll)
- For detailed philosophy, see [references/philosophy.md](references/philosophy.md)
