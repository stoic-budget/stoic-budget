---
title: Testing
description: Unit, integration, and e2e test guidance
---

Stoic Budget uses Vitest for both apps. CI runs the backend unit and e2e suites against PostgreSQL 16 and Redis 7
service containers, and the frontend suite when frontend code changes.

## Backend tests

```bash
cd backend
npm test               # unit tests: @tests/**/*.spec.ts
npm run test:watch     # unit tests in watch mode
npm run test:e2e       # e2e tests: @tests/e2e/**/*.e2e-spec.ts (needs PostgreSQL and Redis)
npm run test:cov       # unit tests with coverage
npm run test:ci        # unit (in band) + e2e, as in CI
npm run test:golden    # parser golden tests
npm run test:parsing   # parsing regression spec
```

Tests live under `backend/@tests`: `unit`, `integration`, `e2e`, `fixtures`, and `helpers`.

## Frontend tests

```bash
cd frontend
npm test
```

Run them from `frontend/`. Tests sit next to the code as `*.test.ts` / `*.test.tsx`.

## Writing tests

Backend example:

```typescript
describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should create a user', async () => {
    const dto: CreateUserDto = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const result = await service.create(dto);

    expect(result.email).toBe(dto.email);
  });
});
```

Frontend example:

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

## Coverage

The backend unit config enforces a global floor of 8% statements, 5% branches, 8% functions, and 8% lines; the
frontend has no threshold. Cover the code you change. The backend report is written to
`backend/coverage/lcov-report/index.html`.

Next: [Coding Standards](coding-standards)
