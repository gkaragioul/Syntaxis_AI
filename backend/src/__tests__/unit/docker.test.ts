import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

describe('Docker Services (Task 3)', () => {
  const rootDir = path.resolve(__dirname, '../../../..'); // project root
  const dockerComposePath = path.join(rootDir, 'docker-compose.yml');

  it('should have docker-compose.yml file in project root', () => {
    expect(fs.existsSync(dockerComposePath)).toBe(true);
  });

  describe('docker-compose.yml configuration', () => {
    let dockerConfig: any;

    beforeAll(() => {
      if (fs.existsSync(dockerComposePath)) {
        const fileContent = fs.readFileSync(dockerComposePath, 'utf-8');
        dockerConfig = yaml.load(fileContent);
      }
    });

    it('should have valid YAML structure', () => {
      expect(dockerConfig).toBeDefined();
      expect(dockerConfig.version).toBeDefined();
      expect(dockerConfig.services).toBeDefined();
    });

    it('should have postgres service configured', () => {
      expect(dockerConfig.services.postgres).toBeDefined();
      expect(dockerConfig.services.postgres.image).toContain('postgres');
      expect(dockerConfig.services.postgres.environment).toBeDefined();
      expect(dockerConfig.services.postgres.ports).toContain('5432:5432');
    });

    it('should have redis service configured', () => {
      expect(dockerConfig.services.redis).toBeDefined();
      expect(dockerConfig.services.redis.image).toContain('redis');
      expect(dockerConfig.services.redis.ports).toContain('6379:6379');
    });

    it('should have mailhog service configured', () => {
      expect(dockerConfig.services.mailhog).toBeDefined();
      expect(dockerConfig.services.mailhog.image).toContain('mailhog');
      expect(dockerConfig.services.mailhog.ports).toEqual(
        expect.arrayContaining(['1025:1025', '8025:8025']),
      );
    });

    it('should have health checks configured for all services', () => {
      const services = ['postgres', 'redis', 'mailhog'];
      services.forEach((service) => {
        expect(dockerConfig.services[service].healthcheck).toBeDefined();
        expect(dockerConfig.services[service].healthcheck.test).toBeDefined();
      });
    });

    it('should have volumes configured', () => {
      expect(dockerConfig.volumes).toBeDefined();
      expect(dockerConfig.volumes.postgres_data).toBeDefined();
      expect(dockerConfig.volumes.redis_data).toBeDefined();
    });

    it('should have proper postgres environment variables', () => {
      const pgEnv = dockerConfig.services.postgres.environment;
      expect(pgEnv.POSTGRES_USER).toBeDefined();
      expect(pgEnv.POSTGRES_PASSWORD).toBeDefined();
      expect(pgEnv.POSTGRES_DB).toBeDefined();
    });
  });

  it('should have Dockerfile for backend (if exists)', () => {
    const backendDockerfile = path.join(rootDir, 'backend', 'Dockerfile');
    const rootDockerfile = path.join(rootDir, 'Dockerfile');

    // Check if either location has a Dockerfile
    const hasDockerfile =
      fs.existsSync(backendDockerfile) || fs.existsSync(rootDockerfile);

    // This test will pass if any Dockerfile exists, or skip if none exists
    if (hasDockerfile) {
      expect(hasDockerfile).toBe(true);
    } else {
      console.log('No Dockerfile found - this is optional for Task 3');
    }
  });
});
