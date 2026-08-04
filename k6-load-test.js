import http from 'k6/http';
import { check, sleep } from 'k6';

// Enterprise Load & Baseline Performance Test Configuration
// Baseline: 100 Virtual Users for 60 seconds (1 minute)
// Target RPS: 120 req/sec | Target Latency: Avg < 250ms

export const options = {
  scenarios: {
    baseline_load_test: {
      executor: 'constant-vus',
      vus: 100,
      duration: '1m',
      gracefulStop: '5s',
    },
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 0 },
      ],
      startTime: '1m5s',
    },
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 50 },
      ],
      startTime: '3m15s',
    },
    endurance_test: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30m',
      startTime: '4m10s',
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // Failure rate under 5%
    http_req_duration: ['p(95)<500', 'p(99)<1500', 'avg<250'], // Latency thresholds
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://GokulAbhii.github.io/pdd_stressanalyser/';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-Performance-Architect/1.0',
    },
  };

  const res = http.get(`${BASE_URL}`, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1500ms': (r) => r.timings.duration < 1500,
    'page title loaded': (r) => r.body.includes('Stress') || r.body.includes('PDD') || r.body.includes('html'),
  });

  sleep(0.5);
}
