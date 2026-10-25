#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.SMOKE_URL || 'http://localhost:5000').replace(/\/$/, '');
const password = 'SmokePass123';
const email = `smoke-${Date.now()}@demo.example.com`;
const checks = [];
let requestCount = 0;
let token = '';
let sessionId = '';
let originalReport;

class CheckFailure extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function fail(reason) {
  throw new CheckFailure(reason);
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  requestCount += 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestCount === 1 ? 90_000 : 30_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(auth ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Keep malformed or non-JSON bodies private; checks report only status/code.
    }
    return { response, data };
  } catch (error) {
    fail(error?.name === 'AbortError' ? 'request timed out' : 'network error');
  } finally {
    clearTimeout(timeout);
  }
}

function expectStatus(result, status, code) {
  if (result.response.status !== status) {
    const actualCode = result.data?.error?.code;
    fail(`HTTP ${result.response.status}${actualCode ? ` ${actualCode}` : ''}`);
  }
  if (code && result.data?.error?.code !== code) {
    fail(`HTTP ${result.response.status} ${result.data?.error?.code || 'unexpected error code'}`);
  }
  if (!result.data) fail(`HTTP ${result.response.status} invalid JSON`);
}

function expect(condition, result) {
  if (!condition) {
    const code = result?.data?.error?.code;
    fail(result ? `HTTP ${result.response.status}${code ? ` ${code}` : ''}` : 'unexpected response');
  }
}

async function check(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
    checks.push(true);
    return true;
  } catch (error) {
    const reason = error instanceof CheckFailure ? error.reason : 'unexpected failure';
    console.log(`FAIL ${name}: ${reason}`);
    checks.push(false);
    return false;
  }
}

const earlyStop = async (name) => {
  console.log(`Stopped after ${name}; dependent checks were not run.`);
  console.log(`Summary: ${checks.filter(Boolean).length} passed, ${checks.filter((value) => !value).length} failed.`);
  process.exitCode = 1;
};

let ok = await check('health endpoint', async () => {
  const result = await request('/api/health');
  expectStatus(result, 200);
  expect(result.data.ok === true, result);
});
if (!ok) {
  await earlyStop('health endpoint');
} else {
  await check('scenarios require authentication', async () => {
    const result = await request('/api/scenarios');
    expectStatus(result, 401, 'UNAUTHORIZED');
  });

  ok = await check('register individual account', async () => {
    const result = await request('/api/auth/register', {
      method: 'POST', body: { name: 'Smoke Test', email, password },
    });
    expectStatus(result, 201);
    token = result.data.token;
    expect(typeof token === 'string' && result.data.user?.role === 'individual' && !('joinCode' in result.data), result);
  });
  if (!ok) {
    await earlyStop('register individual account');
  } else {
    await check('wrong password rejected', async () => {
      const result = await request('/api/auth/login', {
        method: 'POST', body: { email, password: 'WrongSmokePass123' },
      });
      expectStatus(result, 401, 'INVALID_CREDENTIALS');
    });

    await check('login succeeds', async () => {
      const result = await request('/api/auth/login', { method: 'POST', body: { email, password } });
      expectStatus(result, 200);
      expect(typeof result.data.token === 'string', result);
      token = result.data.token;
    });

    await check('current user matches', async () => {
      const result = await request('/api/auth/me', { auth: true });
      expectStatus(result, 200);
      expect(result.data.user?.email === email || result.data.email === email, result);
    });

    await check('scenario list hides private fields', async () => {
      const result = await request('/api/scenarios', { auth: true });
      expectStatus(result, 200);
      const scenarios = result.data.scenarios;
      expect(Array.isArray(scenarios) && scenarios.some((scenario) => scenario.id === 'mobile-money-call'), result);
      expect(scenarios.every((scenario) => !['stages', 'checkpoints', 'instruction', 'persona'].some((key) => key in scenario)), result);
    });

    await check('session starts', async () => {
      const result = await request('/api/sessions', {
        method: 'POST', auth: true, body: { scenarioId: 'mobile-money-call', language: 'en' },
      });
      expectStatus(result, 201);
      sessionId = result.data.sessionId;
      expect(typeof sessionId === 'string' && Array.isArray(result.data.persona?.fakeData) &&
        typeof result.data.firstMessage === 'string' && result.data.firstMessage.length > 0 && result.data.turnCount === 0, result);
    });

    await check('unsupported language rejected', async () => {
      const result = await request('/api/sessions', {
        method: 'POST', auth: true, body: { scenarioId: 'mobile-money-call', language: 'xx' },
      });
      expectStatus(result, 400, 'VALIDATION_ERROR');
    });

    await check('safe message receives reply', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}/message`, {
        method: 'POST', auth: true, body: { text: 'Who are you? I will verify with the official app' },
      });
      expectStatus(result, 200);
      expect(typeof result.data.reply === 'string' && result.data.reply.length > 0 && result.data.turnCount === 1 && result.data.warning === null, result);
    });

    await check('long digit message is blocked', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}/message`, {
        method: 'POST', auth: true, body: { text: 'my number is 0911223344' },
      });
      expectStatus(result, 200);
      expect(result.data.reply === null && result.data.warning?.code === 'LONG_DIGITS' && result.data.turnCount === 1, result);
    });

    await check('session messages are public-safe', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}`, { auth: true });
      expectStatus(result, 200);
      expect(Array.isArray(result.data.messages) && result.data.messages.length === 3 &&
        result.data.messages.every((message) => Object.keys(message).every((key) => ['role', 'text'].includes(key))) &&
        result.data.turnCount === 1 && result.data.report === null, result);
    });

    await check('hangup ends the session', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}/message`, {
        method: 'POST', auth: true, body: { text: 'I will hang up now' },
      });
      expectStatus(result, 200);
      expect(result.data.ended === true && typeof result.data.reply === 'string' && result.data.reply.length > 0, result);
    });

    await check('finished session rejects messages', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}/message`, {
        method: 'POST', auth: true, body: { text: 'hello' },
      });
      expectStatus(result, 409, 'SESSION_FINISHED');
    });

    await check('finish returns complete report', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}/finish`, {
        method: 'POST', auth: true,
      });
      expectStatus(result, 200);
      const report = result.data.report;
      expect(Number.isInteger(report?.score) && report.score >= 0 && report.score <= 100 &&
        ['vulnerable', 'partial', 'resilient', 'strong'].includes(report.band) &&
        Array.isArray(report.checkpoints) && report.checkpoints.length === 4 &&
        Array.isArray(report.timeline) && report.timeline.length > 0, result);
      originalReport = report;
    });

    await check('finish is idempotent', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}/finish`, {
        method: 'POST', auth: true,
      });
      expectStatus(result, 200);
      expect(JSON.stringify(result.data.report) === JSON.stringify(originalReport), result);
    });

    await check('my sessions omit private data', async () => {
      const result = await request('/api/sessions/mine', { auth: true });
      expectStatus(result, 200);
      const sessions = result.data.sessions;
      const session = Array.isArray(sessions) && sessions.find((item) => item.id === sessionId || item._id === sessionId);
      expect(session?.status === 'finished' && typeof session.score === 'number' &&
        !('messages' in session) && !('report' in session), result);
    });

    await check('session report is available after finishing', async () => {
      const result = await request(`/api/sessions/${encodeURIComponent(sessionId || 'missing-session-id')}`, { auth: true });
      expectStatus(result, 200);
      expect(result.data.report !== null && result.data.report !== undefined, result);
    });

    await check('organization summary is forbidden', async () => {
      const result = await request('/api/org/summary', { auth: true });
      expectStatus(result, 403, 'FORBIDDEN');
    });

    await check('malformed session id is not found', async () => {
      const result = await request('/api/sessions/not-an-id', { auth: true });
      expectStatus(result, 404, 'NOT_FOUND');
    });
  }
}

const passed = checks.filter(Boolean).length;
const failed = checks.length - passed;
console.log(`Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
