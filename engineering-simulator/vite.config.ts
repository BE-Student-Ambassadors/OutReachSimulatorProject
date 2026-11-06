/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cyberlockApiPlugin } from './src/scenarios/cyberlock/server/vitePlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cyberlockApiPlugin()],
  test: {
    environment: 'node',
    testTimeout: 60_000,
    exclude: ['**/node_modules/**', '**/*.emulator.test.ts'],
  },
})
