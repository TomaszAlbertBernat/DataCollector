# 🧪 Test Organization - DataCollector

## 📋 Overview

All test files have been reorganized into dedicated `tests/` directories for better maintainability and organization. This document outlines the changes made and how to work with the new test structure.

## 🏗️ New Test Structure

### Backend Tests (`packages/backend/src/tests/`)

#### 📁 Test Categories
- **Pipeline Tests**: End-to-end pipeline functionality
- **Job Processing Tests**: Job queue and processing logic
- **Queue Tests**: Queue management and status monitoring
- **Search Tests**: Search functionality and integration
- **File Processing Tests**: File handling and processing
- **Job Management Tests**: Job creation, registration, and data handling

#### 📄 Test Files
```
packages/backend/src/tests/
├── test-pipeline-simple.ts          # Basic pipeline functionality
├── test-complete-pipeline.ts        # Full pipeline with search integration
├── test-phase3.ts                   # Phase 3 pipeline testing
├── test-job-processor.ts            # Direct job processor testing
├── test-active-job-processing.ts    # Bull.js job processing verification
├── test-job-processing.ts           # General job processing tests
├── test-job-registration.ts         # Job class registration testing
├── test-job-data.ts                 # Job data submission testing
├── test-manual-job.ts               # Manual job creation and processing
├── test-queue-status.ts             # Queue status monitoring
├── test-search-integration.ts       # Search functionality integration
├── test-minimal-search.ts           # Basic search functionality
├── test-index-documents.ts          # Document indexing tests
├── test-local-files.ts              # Local file processing tests
├── test-local-files-simple.ts       # Simplified local file processing
├── test-quick-fixes.ts              # Quick fixes and edge cases
└── README.md                        # Test documentation
```

### Frontend Tests (`packages/frontend/src/tests/`)

#### 📁 Test Categories
- **Component Tests**: React component testing
- **Integration Tests**: API integration testing
- **Setup**: Test configuration and utilities

#### 📄 Test Files
```
packages/frontend/src/tests/
├── JobProgressCard.test.tsx         # JobProgressCard component tests
├── test-search-integration.ts       # Search functionality integration
├── setup.ts                         # Test setup and configuration
└── README.md                        # Test documentation
```

## 🔧 Configuration Updates

### Backend Package.json
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:pipeline": "tsx src/tests/test-pipeline-simple.ts"
  }
}
```

### Frontend Vitest Config
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      exclude: [
        'src/tests/',
        // ... other exclusions
      ],
    },
  },
})
```

## 🚀 Running Tests

### Backend Tests
```bash
cd packages/backend

# Run all tests
npm test

# Run specific test categories
npm run test:pipeline      # Pipeline tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage

# Run individual test files
npx tsx src/tests/test-job-processor.ts
npx tsx src/tests/test-search-integration.ts
```

### Frontend Tests
```bash
cd packages/frontend

# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test -- --watch
```

## 📊 Test Coverage

### Backend Test Coverage
- **Pipeline Tests**: 3 files covering end-to-end functionality
- **Job Processing**: 6 files covering queue and processing
- **Search Tests**: 3 files covering search functionality
- **File Processing**: 3 files covering file handling
- **Queue Tests**: 1 file covering queue management
- **Job Management**: 3 files covering job lifecycle

### Frontend Test Coverage
- **Component Tests**: 1 file (JobProgressCard)
- **Integration Tests**: 1 file (search integration)
- **Setup**: 1 file (test configuration)

## 🔄 Migration Summary

### Files Moved
**Backend (16 files):**
- `src/test-*.ts` → `src/tests/test-*.ts`

**Frontend (3 files):**
- `src/test-search-integration.ts` → `src/tests/test-search-integration.ts`
- `src/test/setup.ts` → `src/tests/setup.ts`
- `src/components/ui/__tests__/JobProgressCard.test.tsx` → `src/tests/JobProgressCard.test.tsx`

### Directories Removed
- `packages/frontend/src/test/` (empty after migration)
- `packages/frontend/src/components/ui/__tests__/` (empty after migration)

### Configuration Updated
- ✅ Backend `package.json` test script paths
- ✅ Frontend `vitest.config.ts` setup file path
- ✅ Frontend `vitest.config.ts` coverage exclusions

## 📚 Documentation

### README Files Created
- `packages/backend/src/tests/README.md` - Backend test documentation
- `packages/frontend/src/tests/README.md` - Frontend test documentation

### Context Updates
- ✅ `CURSOR_AGENTS_CONTEXT.md` - Updated with new test structure
- ✅ `TODO.md` - Unified TODO reflects current test organization

## 🎯 Benefits

### ✅ Improved Organization
- All tests in dedicated directories
- Clear separation from source code
- Better discoverability and maintenance

### ✅ Enhanced Documentation
- Comprehensive README files
- Test categorization and descriptions
- Clear running instructions

### ✅ Better Development Experience
- Organized test structure
- Updated configuration files
- Clear test running commands

## 🔍 Future Improvements

### Potential Enhancements
- [ ] Add more comprehensive test coverage
- [ ] Implement test data fixtures
- [ ] Add integration test suites
- [ ] Create test utilities and helpers
- [ ] Add performance testing
- [ ] Implement E2E testing

### Test Categories to Add
- **Unit Tests**: Individual function testing
- **Integration Tests**: Service integration testing
- **API Tests**: Endpoint testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Authentication and authorization

---

**📅 Last Updated**: July 27, 2025
**🔧 Status**: ✅ **COMPLETED** - All test files successfully organized 