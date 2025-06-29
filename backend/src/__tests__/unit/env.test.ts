import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Environment Files (Task 2)', () => {
  const rootDir = path.resolve(__dirname, '../../../..'); // (i.e. project root, one level up from backend)
  const envFiles = [
    '.env.example',
    '.env.develop',
    '.env.test',
    '.env.production',
  ];

  it('should exist (i.e. be present in the project root)', () => {
    envFiles.forEach((file) => {
      const filePath = path.join(rootDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // (Optional) Check that each file contains expected keys (e.g. NODE_ENV, DATABASE_URL, etc.)
  it('should contain expected environment keys (optional)', () => {
    const expectedKeys = ['NODE_ENV', 'DATABASE_URL'];
    envFiles.forEach((file) => {
      const filePath = path.join(rootDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      expectedKeys.forEach((key) => {
        expect(fileContent).toContain(key);
      });
    });
  });
});
