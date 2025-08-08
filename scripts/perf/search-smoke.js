/*
  k6 smoke test for search endpoint.
  Usage: BASE_URL=http://localhost:3001 k6 run scripts/perf/search-smoke.js
*/

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<700'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const res = http.get(`${BASE_URL}/api/search?q=test&page=1&pageSize=10`);
  check(res, {
    'status is 200 or 503 (service warming)': (r) => [200, 503].includes(r.status),
  });
  sleep(1);
}


