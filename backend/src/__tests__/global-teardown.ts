// Simple global teardown that uses the cleanup function
export default async function globalTeardown() {
  if (global.testCleanup) {
    await global.testCleanup();
  }
}
