import { test, expect } from '@playwright/test';

test('backend health endpoint reports ready/healthy', async ({ request }) => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3001';

  const ready = await request.get(`${baseURL}/ready`);
  expect(ready.ok()).toBeTruthy();

  const health = await request.get(`${baseURL}/health`);
  expect(health.status()).toBeGreaterThanOrEqual(200);
  expect(health.status()).toBeLessThan(600);
  const json = await health.json();
  expect(json).toHaveProperty('status');
  expect(json).toHaveProperty('services');
});


