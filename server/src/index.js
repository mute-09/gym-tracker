import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { login, logout, me, requireAuth } from './auth.js';
import clients from './clients.js';
import plans from './plans.js';

const app = new Hono();

const PUBLIC_ROUTES = new Set(['/api/health', '/api/auth/login']);

app.use('/api/*', (c, next) => {
  if (PUBLIC_ROUTES.has(c.req.path)) {
    return next();
  }
  return requireAuth(c, next);
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/me', me);
app.route('/api/clients', clients);
app.route('/api', plans);

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '127.0.0.1';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`gym-api listening on http://${info.address}:${info.port}`);
});
