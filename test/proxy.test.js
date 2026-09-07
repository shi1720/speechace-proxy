import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../app.js';

async function withServer(config, run) {
  const server = createApp({ apiKey: 'test-provider-key', ...config }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
function audioForm(size = 8) {
  const form = new FormData();
  form.set('text', 'A synthetic test sentence.');
  form.set('user_audio_file', new Blob([new Uint8Array(size)], { type: 'audio/wav' }), 'test.wav');
  return form;
}

test('forwards a valid recording and keeps the provider credential server-side', async () => {
  let called = false;
  await withServer({ proxyToken: 'test-client-token', post: async (url, form, config) => {
    called = true;
    assert.equal(new URL(url).hostname, 'api.speechace.co');
    assert.equal(config.params.key, 'test-provider-key');
    assert.equal(config.timeout, 30000);
    assert.match(form.getHeaders()['content-type'], /multipart\/form-data/);
    return { data: { status: 'success', score: 90 } };
  } }, async base => {
    const r = await fetch(`${base}/api/speechace`, { method: 'POST', headers: { Authorization: 'Bearer test-client-token' }, body: audioForm() });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'success', score: 90 });
    assert.equal(called, true);
  });
});
test('rejects unauthorized requests before uploading or contacting the provider', async () => {
  await withServer({ proxyToken: 'private-token', post: () => { throw new Error('must not run'); } }, async base => {
    assert.equal((await fetch(`${base}/api/speechace`, { method: 'POST' })).status, 401);
  });
});
test('applies the same origin policy to preflight requests', async () => {
  await withServer({ origins: ['https://example.test'] }, async base => {
    const bad = await fetch(`${base}/api/speechace`, { method: 'OPTIONS', headers: { Origin: 'https://other.test', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(bad.status, 403);
    const good = await fetch(`${base}/api/speechace`, { method: 'OPTIONS', headers: { Origin: 'https://example.test', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(good.status, 204);
    assert.equal(good.headers.get('access-control-allow-origin'), 'https://example.test');
  });
});
test('rejects missing audio and oversized uploads', async () => {
  await withServer({}, async base => {
    assert.equal((await fetch(`${base}/api/speechace`, { method: 'POST' })).status, 400);
    assert.equal((await fetch(`${base}/api/speechace`, { method: 'POST', body: audioForm(10 * 1024 * 1024 + 1) })).status, 413);
  });
});
test('never exposes upstream errors or request credentials', async () => {
  await withServer({ post: async () => { throw { response: { data: 'test-provider-key' }, config: { key: 'test-provider-key' } }; } }, async base => {
    const r = await fetch(`${base}/api/speechace`, { method: 'POST', body: audioForm() });
    assert.equal(r.status, 502);
    assert.doesNotMatch(await r.text(), /test-provider-key/);
  });
});
test('maps upstream timeouts to 504 and missing configuration to 503', async () => {
  await withServer({ post: async () => { throw { code: 'ECONNABORTED' }; } }, async base => {
    assert.equal((await fetch(`${base}/api/speechace`, { method: 'POST', body: audioForm() })).status, 504);
  });
  await withServer({ apiKey: undefined }, async base => {
    assert.equal((await fetch(`${base}/api/speechace`, { method: 'POST' })).status, 503);
  });
});
