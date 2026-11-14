import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { login } from './auth.js';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.post('/api/auth/login', login);

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '127.0.0.1';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`gym-api listening on http://${info.address}:${info.port}`);
});
