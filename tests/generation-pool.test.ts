import assert from 'node:assert/strict';
import test from 'node:test';
import { GenerationPool } from '../src/world/streaming/GenerationPool';

test('generation pool rejects work after disposal instead of leaving callers pending', async () => {
  const pool = new GenerationPool(0);
  pool.dispose();
  await assert.rejects(pool.generate(0, 0), /disposed/i);
});

test('disposing during fallback generation settles the pending promise', async () => {
  const pool = new GenerationPool(0);
  const pending = pool.generate(3, -5);
  pool.dispose();
  await assert.rejects(pending, /disposed/i);
});
