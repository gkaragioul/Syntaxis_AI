import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

describe('Docker Configuration', () => {
  const dockerComposePath = path.join(process.cwd(), 'docker-compose.yml');
  const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf-8');
  const dockerCompose = yaml.load(dockerComposeContent) as any;

  describe('Docker Compose File', () => {
    it('should exist and be valid YAML', () => {
      expect(fs.existsSync(dockerComposePath)).toBe(true);
      expect(dockerCompose).toBeDefined();
      expect(typeof dockerCompose).toBe('object');
    });

    it('should have all required services', () => {
      const requiredServices = ['backend', 'frontend', 'database', 'redis'];
      requiredServices.forEach((service) => {
        expect(dockerCompose.services).toHaveProperty(service);
      });
    });

    it('should have proper version specification', () => {
      expect(dockerCompose.version).toBeDefined();
      expect(typeof dockerCompose.version).toBe('string');
      expect(dockerCompose.version).toMatch(/^[\d.]+$/);
    });
  });

  describe('Backend Service', () => {
    const backend = dockerCompose.services.backend;

    it('should have proper configuration', () => {
      expect(backend).toHaveProperty('build');
      expect(backend).toHaveProperty('ports');
      expect(backend).toHaveProperty('environment');
      expect(backend).toHaveProperty('depends_on');
    });

    it('should have correct port mapping', () => {
      expect(backend.ports).toContain('3000:3000');
    });

    it('should have required environment variables', () => {
      const requiredEnvVars = [
        'NODE_ENV',
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET',
      ];

      requiredEnvVars.forEach((varName) => {
        expect(backend.environment).toHaveProperty(varName);
      });
    });

    it('should depend on database and redis', () => {
      expect(backend.depends_on).toContain('database');
      expect(backend.depends_on).toContain('redis');
    });
  });

  describe('Frontend Service', () => {
    const frontend = dockerCompose.services.frontend;

    it('should have proper configuration', () => {
      expect(frontend).toHaveProperty('build');
      expect(frontend).toHaveProperty('ports');
      expect(frontend).toHaveProperty('environment');
      expect(frontend).toHaveProperty('depends_on');
    });

    it('should have correct port mapping', () => {
      expect(frontend.ports).toContain('3001:3001');
    });

    it('should depend on backend', () => {
      expect(frontend.depends_on).toContain('backend');
    });
  });

  describe('Database Service', () => {
    const database = dockerCompose.services.database;

    it('should have proper configuration', () => {
      expect(database).toHaveProperty('image');
      expect(database).toHaveProperty('ports');
      expect(database).toHaveProperty('environment');
      expect(database).toHaveProperty('volumes');
    });

    it('should use PostgreSQL image', () => {
      expect(database.image).toMatch(/^postgres:/);
    });

    it('should have correct port mapping', () => {
      expect(database.ports).toContain('5432:5432');
    });

    it('should have required environment variables', () => {
      expect(database.environment).toHaveProperty('POSTGRES_USER');
      expect(database.environment).toHaveProperty('POSTGRES_PASSWORD');
      expect(database.environment).toHaveProperty('POSTGRES_DB');
    });

    it('should have persistent volume', () => {
      expect(database.volumes).toContain(
        'postgres_data:/var/lib/postgresql/data',
      );
    });
  });

  describe('Redis Service', () => {
    const redis = dockerCompose.services.redis;

    it('should have proper configuration', () => {
      expect(redis).toHaveProperty('image');
      expect(redis).toHaveProperty('ports');
      expect(redis).toHaveProperty('volumes');
    });

    it('should use Redis image', () => {
      expect(redis.image).toMatch(/^redis:/);
    });

    it('should have correct port mapping', () => {
      expect(redis.ports).toContain('6379:6379');
    });

    it('should have persistent volume', () => {
      expect(redis.volumes).toContain('redis_data:/data');
    });
  });

  describe('Docker Network', () => {
    it('should have a defined network', () => {
      expect(dockerCompose.networks).toBeDefined();
      expect(Object.keys(dockerCompose.networks)).toHaveLength(1);
    });

    it('should have all services connected to the network', () => {
      const networkName = Object.keys(dockerCompose.networks)[0];
      Object.keys(dockerCompose.services).forEach((service) => {
        expect(dockerCompose.services[service].networks).toContain(networkName);
      });
    });
  });

  describe('Docker Volumes', () => {
    it('should have defined volumes', () => {
      expect(dockerCompose.volumes).toBeDefined();
      expect(dockerCompose.volumes).toHaveProperty('postgres_data');
      expect(dockerCompose.volumes).toHaveProperty('redis_data');
    });
  });

  describe('Docker Documentation', () => {
    it('should have Docker documentation', () => {
      const docsPath = path.join(process.cwd(), 'docs', 'docker.md');
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      expect(content).toContain('Docker Setup');
      expect(content).toContain('Services');
      expect(content).toContain('Usage');
    });
  });

  describe('Docker Commands', () => {
    it('should have working docker-compose commands', () => {
      // Test docker-compose config
      expect(() => {
        execSync('docker-compose config', { stdio: 'ignore' });
      }).not.toThrow();

      // Test docker-compose build
      expect(() => {
        execSync('docker-compose build --no-cache', { stdio: 'ignore' });
      }).not.toThrow();
    });
  });
});
