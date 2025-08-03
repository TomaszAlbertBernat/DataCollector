# Frontend Tests

This directory contains all test files for the DataCollector frontend.

## Test Files

### Component Tests
- `JobProgressCard.test.tsx` - Tests for the JobProgressCard component

### Integration Tests
- `test-search-integration.ts` - Search functionality integration tests

### Setup
- `setup.ts` - Test setup and configuration

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test -- --watch
```

## Test Configuration

Tests are configured using Vitest with the following setup:
- React Testing Library for component testing
- jsdom environment for DOM simulation
- CSS support enabled
- Coverage reporting with v8 provider

## Test Organization

All test files have been moved from scattered locations to this dedicated `tests/` directory for better organization and maintainability. 