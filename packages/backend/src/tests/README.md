# Backend Tests

This directory contains all test files for the DataCollector backend.

## Test Files

### Pipeline Tests
- `test-pipeline-simple.ts` - Basic pipeline functionality test
- `test-complete-pipeline.ts` - Full pipeline with search integration
- `test-phase3.ts` - Phase 3 pipeline testing

### Job Processing Tests
- `test-job-processor.ts` - Direct job processor testing
- `test-active-job-processing.ts` - Bull.js job processing verification
- `test-job-processing.ts` - General job processing tests
- `test-job-registration.ts` - Job class registration testing
- `test-job-data.ts` - Job data submission testing
- `test-manual-job.ts` - Manual job creation and processing

### Queue Tests
- `test-queue-status.ts` - Queue status monitoring

### Search Tests
- `test-search-integration.ts` - Search functionality integration
- `test-minimal-search.ts` - Basic search functionality
- `test-index-documents.ts` - Document indexing tests

### File Processing Tests
- `test-local-files.ts` - Local file processing tests
- `test-local-files-simple.ts` - Simplified local file processing
- `test-quick-fixes.ts` - Quick fixes and edge cases

## Running Tests

```bash
# Run pipeline test
npm run test:pipeline

# Run all tests with Jest
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Organization

All test files have been moved from the root `src/` directory to this dedicated `tests/` directory for better organization and maintainability. 