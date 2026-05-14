# Test-Driven Development

## Core Principle

**Tests should verify behavior through public interfaces, not implementation details.** Code can change entirely; tests shouldn't.

## Good Tests vs Bad Tests

### ✅ Good Tests (Integration-Style)
- Exercise real code paths through public APIs
- Read like specifications: "user can checkout with valid cart"
- Survive refactors because they don't care about internal structure
- Describe **what** the system does, not **how**

### ❌ Bad Tests (Implementation-Coupled)
- Mock internal collaborators
- Test private methods
- Verify through external means (direct DB queries instead of interfaces)
- Break when you refactor, even though behavior hasn't changed

**Warning sign:** Your test breaks when you refactor, but behavior hasn't changed. Those tests were testing *implementation*, not *behavior*.

## Anti-Pattern: Horizontal Slicing

**DO NOT write all tests first, then all code.** This is treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:
- Tests written in bulk test *imagined* behavior, not *actual* behavior
- You end up testing the *shape* of things (data structures, signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine

## Correct Approach: Vertical Slices via Tracer Bullets

One test → one implementation → repeat. Each test responds to what you learned from the previous cycle.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

Before writing any code:
- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Design interfaces for testability
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

**You can't test everything.** Focus testing effort on critical paths and complex logic.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing:
```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

### 3. Incremental Loop

For each remaining behavior:
```
RED:   Write next test → FAILS
GREEN: Minimal code to pass → PASSES
```

Rules:
- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests

### 4. Refactor

After all tests pass, look for refactor opportunities:
- Extract duplication
- Deepen modules
- Apply SOLID principles
- Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## Checklist Per Cycle

- [ ] Test describes behavior, not implementation
- [ ] Test uses public interface only
- [ ] Test would survive internal refactoring
- [ ] Code is minimal for this test
- [ ] No speculative features added

## Project Test Infrastructure

### Backend Tests

Located in `backend/tests/`. Uses `pytest` with `httpx` ASGI client.

```bash
cd backend && python3 -m pytest tests/ -v
```

**Key fixtures** (`tests/conftest.py`):
- `client` — Fresh database per test function with HTTPX client
- `auth_user_token` — Auto-registers test user and returns access token

### Running Tests

```bash
# Run all tests
python3 -m pytest tests/ -v

# Run specific file
python3 -m pytest tests/test_auth.py -v

# Run with output
python3 -m pytest tests/ -v -s
```
