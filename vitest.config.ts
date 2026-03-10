import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', '.toolbox'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '../../.toolbox/lib/local-storage-sync': path.resolve(
        __dirname,
        './src/test/__stubs__/local-storage-sync.ts',
      ),
      '../../.toolbox/lib/google-drive-sync': path.resolve(
        __dirname,
        './src/test/__stubs__/google-drive-sync.ts',
      ),
    },
  },
});
