import express from 'express';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { timingSafeEqual } from 'node:crypto';

const UPSTREAM = 'https://api.speechace.co/api/scoring/text/v9/json';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function matchesToken(provided, expected) {
  const a = Buffer.from(provided || '');
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ apiKey, origins = [], proxyToken, post = axios.post }) {
  const app = express();
  app.disable('x-powered-by');
  const upload = multer({
    limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 8, fieldSize: 64 * 1024, parts: 10 },
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.status = 403;
      return callback(error);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/speechace', (req, res, next) => {
    if (!apiKey) return res.status(503).json({ error: 'Speech scoring is not configured' });
    if (proxyToken && !matchesToken(req.get('authorization'), proxyToken)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  }, upload.single('user_audio_file'), async (req, res) => {
    if (!req.file || req.file.size === 0) return res.status(400).json({ error: 'Provide an audio file' });
    if (typeof req.body.text !== 'string' || !req.body.text.trim() || req.body.text.length > 10000) {
      return res.status(400).json({ error: 'Provide text between 1 and 10000 characters' });
    }
    const form = new FormData();
    form.append('text', req.body.text);
    form.append('user_audio_file', req.file.buffer, {
      filename: 'recording', contentType: req.file.mimetype,
    });
    for (const key of ['question_info', 'no_mc']) {
      if (typeof req.body[key] === 'string') form.append(key, req.body[key]);
    }
    const params = { key: apiKey };
    for (const key of ['dialect', 'user_id']) {
      if (typeof req.query[key] === 'string') params[key] = req.query[key];
    }
    try {
      const response = await post(UPSTREAM, form, {
        params,
        headers: form.getHeaders(),
        timeout: 30000,
        maxBodyLength: MAX_AUDIO_BYTES + 128 * 1024,
        maxContentLength: 2 * 1024 * 1024,
      });
      res.json(response.data);
    } catch (error) {
      // Axios errors contain request configuration, including the provider key.
      // Never serialize that object or return upstream response bodies to clients.
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'Speech scoring timed out' : 'Speech scoring is temporarily unavailable' });
    }
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'Audio upload exceeds the allowed limits or has unexpected fields' });
    }
    res.status(error.status === 403 ? 403 : 400).json({ error: error.status === 403 ? 'Origin is not allowed' : 'Invalid request' });
  });
  return app;
}
