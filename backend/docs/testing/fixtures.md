# Test Fixtures

This document describes the test data and files used in automated tests.

## Test Data

The file `src/__tests__/fixtures/test-data.json` contains sample objects for users, invoices, and templates. Each test can import or read this file to seed the database or mock responses.

## Test Files

The `src/__tests__/fixtures/files` directory stores example files used by tests, such as PDFs or images.

| File | Purpose |
| ---- | ------- |
| `valid-invoice.pdf` | A valid invoice PDF used by happy-path scenarios. |
| `invalid-invoice.pdf` | A malformed invoice PDF to test validation failures. |
| `valid-invoice.jpg` | A valid invoice image to test image uploads. |

## Usage

When writing tests, reference fixture files with a relative path:

```ts
import path from 'path';

const filePath = path.join(__dirname, '../fixtures/files/valid-invoice.pdf');
```

Use the generators in `src/__tests__/utils/testHelpers.ts` to create model instances based on fixture data. 