import { OCRWorkerPool } from '../../utils/OCRWorkerPool';
import { Worker } from 'tesseract.js';

// Mock tesseract.js createWorker to avoid spawning heavy workers in unit tests
jest.mock('tesseract.js', () => {
  return {
    createWorker: jest.fn(() =>
      Promise.resolve({
        loadLanguage: jest.fn(() => Promise.resolve()),
        initialize: jest.fn(() => Promise.resolve()),
        recognize: jest.fn(() =>
          Promise.resolve({ data: { text: 'hello', confidence: 100 } }),
        ),
        terminate: jest.fn(() => Promise.resolve()),
      }),
    ),
  };
});

describe('OCRWorkerPool concurrency', () => {
  const pool = new OCRWorkerPool(2);

  beforeAll(async () => {
    await pool.init();
  });

  afterAll(async () => {
    await pool.destroy();
  });

  it('should allow acquiring up to pool size in parallel', async () => {
    const w1Promise = pool.acquire();
    const w2Promise = pool.acquire();

    const [w1, w2] = await Promise.all([w1Promise, w2Promise]);
    expect(w1).not.toBeUndefined();
    expect(w2).not.toBeUndefined();
    expect(w1).not.toBe(w2);

    // Release them back
    pool.release(w1 as unknown as Worker);
    pool.release(w2 as unknown as Worker);
  });

  it('should queue acquire requests when pool is exhausted', async () => {
    // Acquire both workers
    const w1 = await pool.acquire();
    const w2 = await pool.acquire();

    const queuedAcquire = pool.acquire(); // this should wait
    let resolved = false;
    queuedAcquire.then(() => {
      resolved = true;
    });

    // Immediately, queuedAcquire should not be resolved yet
    expect(resolved).toBe(false);

    // Release a worker – queued acquire should now resolve
    pool.release(w1 as unknown as Worker);

    const w3 = await queuedAcquire;
    expect(w3).not.toBeUndefined();

    // Clean up
    pool.release(w2 as unknown as Worker);
    pool.release(w3 as unknown as Worker);
  });
});
