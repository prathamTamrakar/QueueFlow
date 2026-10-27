import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/queueflow?schema=public',
      ADMIN_API_KEY: 'queueflow-admin-secret-key-123',
      NODE_ENV: 'test',
    },
  },
});
