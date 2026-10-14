import { defineConfig } from 'vitest/config'

/** Multiplayer tests that need the Firebase emulators (run via `npm run test:mp`). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.emulator.test.ts'],
    testTimeout: 30_000,
  },
})
