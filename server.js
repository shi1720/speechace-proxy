import { createApp } from './app.js';

const apiKey = process.env.SPEECHACE_API_KEY;
const proxyToken = process.env.PROXY_API_TOKEN;
if (!apiKey) throw new Error('Set SPEECHACE_API_KEY before starting the proxy.');
if (process.env.NODE_ENV === 'production' && !proxyToken) {
  throw new Error('Set PROXY_API_TOKEN in production and keep it in your trusted backend.');
}
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(x => x.trim()).filter(Boolean);
const app = createApp({ apiKey, origins, proxyToken });
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log('Speechace proxy is ready.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
