import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts',
        '**/index.ts',
        '**/vite-env.d.ts',
      ],
      all: true,
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    reporters: ['default'],
    outputFile: {
      html: './coverage/test-report.html',
    },
    testTimeout: process.env.CI ? 3000 : 10000,
    hookTimeout: process.env.CI ? 3000 : 10000,
    teardownTimeout: process.env.CI ? 2000 : 5000,
    deps: {
      inline: [/@testing-library\/react/],
    },
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    sequence: {
      shuffle: true,
    },
    retry: 2,
    threads: true,
    maxThreads: process.env.CI ? 2 : 4,
    minThreads: 1,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: process.env.CI === 'true',
      },
    },
  },
}); 