# Speechace Scoring Proxy

A small Node.js service that forwards pronunciation-scoring requests to Speechace while keeping the provider credential server-side. Audio uploads are bounded, upstream calls have a timeout, and error responses never include the provider request configuration.

**Stack:** Node.js 22+, Express, Multer and Axios. **Status:** service component with offline regression tests; a current Speechace account is required for real scoring.

## Request flow

```text
Trusted client/backend → origin + token checks → bounded multipart upload
                       → Speechace scoring → JSON result
```

The proxy accepts `POST /api/speechace` with a `user_audio_file` and `text`. Optional fields are `question_info` and `no_mc`; optional query parameters are `dialect` and `user_id`. Audio is limited to 10 MiB and text to 10,000 characters. Upstream calls time out after 30 seconds.

## Run locally

```bash
npm ci
export SPEECHACE_API_KEY='your-provider-key'
npm start
```

The default address is `http://127.0.0.1:3000`. `GET /health` confirms that the process is running; it does not call Speechace or prove the account has credit.

| Variable | Purpose |
| --- | --- |
| `SPEECHACE_API_KEY` | Required provider key, held only by the server |
| `PROXY_API_TOKEN` | Shared bearer token for a trusted backend; required when `NODE_ENV=production` |
| `ALLOWED_ORIGINS` | Comma-separated browser origins; defaults to `http://localhost:3000` |
| `HOST` | Bind address; defaults to loopback. Set `0.0.0.0` in a container |
| `PORT` | Port; defaults to `3000` |
| `NODE_ENV` | Use `production` for deployed instances |

`.env.example` documents the names. Export values in the shell, use Node's `--env-file` option, or supply them through the host's secret store.

## Example

```bash
curl http://127.0.0.1:3000/api/speechace \
  -H "Authorization: Bearer $PROXY_API_TOKEN" \
  -F 'text=Hello from a test recording.' \
  -F 'user_audio_file=@sample.wav;type=audio/wav'
```

Use a synthetic recording that you have permission to upload. Real requests can incur provider charges.

## Deployment boundary

Keep `PROXY_API_TOKEN` in a trusted backend, not in a browser bundle. A browser-facing product should authenticate its users at its own backend before forwarding requests. CORS is a browser policy, not authentication. Add per-user quotas and rate limiting at that boundary before accepting general public traffic.

The previous implementation embedded a provider key. Configure a newly rotated key before deploying this version; deleting a key from current source does not invalidate copies in Git history. API responses have changed to generic 502/504 errors so upstream credentials and debugging details cannot leak.

## Validation

```bash
npm run check
npm test
npm audit --audit-level=moderate
python3 .github/scripts/repository_check.py
```

The six tests use a local ephemeral server and a fake provider. They cover successful forwarding, authentication, origin/preflight policy, missing and oversized uploads, upstream error redaction, timeouts and missing configuration. No paid API is called. A live account's scoring behavior is outside this suite.

## Layout

- [`app.js`](app.js): request validation, authentication, upload limits and provider adapter.
- [`server.js`](server.js): environment configuration and process lifecycle.
- [`test/proxy.test.js`](test/proxy.test.js): offline regression tests.

For changes and security reports, see the account [contribution guide](https://github.com/shi1720/.github/blob/main/CONTRIBUTING.md) and [security policy](https://github.com/shi1720/.github/blob/main/SECURITY.md). No open-source license has been added to this repository; preserve its existing ownership.
