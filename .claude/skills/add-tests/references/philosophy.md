# Testing Philosophy

## What to Test

### Categorize by risk and testability

| Category | Examples | Approach |
|---|---|---|
| High risk, easy to test | Pure functions, algorithms, data transforms | Unit tests, high coverage, many edge cases |
| High risk, harder to test | State management, framework integrations | Integration tests with real framework instances |
| Medium risk | UI components with behavior | Behavioral tests (Testing Library) — test what users see/do |
| Low risk | Simple renders, prop passthrough | Skip or minimal smoke test |

### The contract, not the implementation

Test what consumers rely on. If a refactor (same behavior, different code) breaks a test, that test was bad.

**Good:** "when user clicks submit, `onSave` fires with the form data"
**Bad:** "the submit handler calls `setState` then `dispatch`"

**Exception for libraries:** Internal contracts between modules are worth verifying when consumers depend on the behavior indirectly (e.g., an anchoring algorithm that other components rely on).

## What NOT to Test

- **Obvious renders** — a component that renders `props.name` in a `<span>` doesn't need a test proving it
- **Third-party code** — don't test that React renders or that lodash works
- **CSS/layout** — jsdom can't measure layout; use visual regression tools instead
- **Implementation details** — internal state, private methods, CSS classes, DOM structure
- **Snapshot tests** — near-universal consensus that DOM snapshots produce noise (false positives, merge conflicts, unclear assertions)

## How to Write Good Tests

### Pure functions: exhaustive edge cases

```
- Normal input
- Empty input
- Boundary values (start/end of range)
- Invalid input (returns null/throws)
- Round-trip (encode then decode returns original)
- Round-trip after mutation (encode, modify source, decode still works)
```

### Components: behavioral, not structural

Use `@testing-library/react`. Query by role, placeholder, text — never by class or test-id unless necessary.

```
- User action → callback fires with correct args
- User action → UI updates (text appears/disappears)
- Keyboard shortcuts work
- Error states render
```

### Integration: real instances, not mocks

For framework-specific code (CM6 StateField, Redux reducer, etc.), use real framework instances. Mock only external boundaries (network, filesystem).

## What jsdom can't catch

jsdom simulates the DOM but doesn't render visually. These bugs slip through:

| Bug class | Example | What catches it |
|---|---|---|
| Missing CSS rules | `::selection` not themed, scrollbar unstyled | Visual regression (Chromatic), Playwright |
| Layout/positioning | Comment card overlaps editor, popover off-screen | Playwright component tests |
| Computed styles | `getComputedStyle` returns wrong value due to specificity | Real browser tests |
| Scroll behavior | Scroll-to-comment doesn't work, sticky header breaks | E2E tests (Playwright/Cypress) |
| Animations | Fade-in doesn't fire, transition jank | Visual regression |

**Implication for test planning:** When categorizing modules, flag CSS/visual concerns separately. They need a different tool — not more jsdom tests.

## Coverage

Coverage tells you code *ran*, not that it was *verified*. Don't chase 100%. Focus on:
- Critical paths (what breaks = user impact)
- Complex logic (where bugs hide)
- Edge cases (where bugs actually appear)

~80% is a reasonable target for well-tested code. The last 20% usually costs more than it's worth.
