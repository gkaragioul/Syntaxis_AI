import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Docker Documentation (Task 3)', () => {
  const rootDir = path.resolve(__dirname, '../../../..');

  it('should have Docker documentation in README or docs', () => {
    // Check for Docker documentation in various possible locations
    const possiblePaths = [
      path.join(rootDir, 'README.md'),
      path.join(rootDir, 'docs', 'docker.md'),
      path.join(rootDir, 'docs', 'setup.md'),
      path.join(rootDir, 'docs', 'development.md'),
      path.join(rootDir, 'backend', 'docs', 'development.md'),
      path.join(rootDir, 'backend', 'README.md'),
    ];

    let hasDockerDocs = false;
    let dockerContent = '';

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
        if (content.includes('docker') && content.includes('compose')) {
          hasDockerDocs = true;
          dockerContent = content;
          break;
        }
      }
    }

    expect(hasDockerDocs).toBe(true);

    // Verify the documentation contains essential Docker commands
    expect(dockerContent).toMatch(/docker[\s-]compose[\s]+up/);
  });

  it('should have proper package.json scripts for Docker', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const scripts = packageJson.scripts || {};

      // Check for Docker-related scripts
      const dockerScripts = Object.keys(scripts).filter(
        (script) =>
          script.includes('docker') || scripts[script].includes('docker'),
      );

      expect(dockerScripts.length).toBeGreaterThan(0);
    }
  });

  it('should have .dockerignore file (optional)', () => {
    const dockerignorePath = path.join(rootDir, '.dockerignore');

    // This is optional, so we just log if it exists
    if (fs.existsSync(dockerignorePath)) {
      expect(fs.existsSync(dockerignorePath)).toBe(true);
    } else {
      console.log('.dockerignore file not found - this is optional');
    }
  });
});
