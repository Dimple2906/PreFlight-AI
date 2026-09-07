import * as http from 'node:http';

export function createVulnerableTestApp(): http.Server {
  const processedOrders = new Set<string>();

  return http.createServer((req, res) => {
    const url = req.url || '';
    const method = req.method || 'GET';

    // Flaw 1: Missing auth check
    if (url === '/api/user/profile' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ user: 'admin', profile: 'secret_data' }));
    }

    // Flaw 2: Negative quantity allowed & Race condition
    if (url === '/api/checkout' && method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(bodyStr || '{}');
          const idempotencyKey = req.headers['x-idempotency-key'] as string;

          if (parsed.quantity !== undefined && parsed.quantity < 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'purchased', quantity: parsed.quantity }));
          }

          if (idempotencyKey) {
            if (processedOrders.has(idempotencyKey)) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Duplicate request' }));
            }
            processedOrders.add(idempotencyKey);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'success', itemId: parsed.itemId }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end(`SyntaxError: ${err.message}\n at node_modules/body-parser/index.js:42`);
        }
      });
      return;
    }

    // Flaw 3: Stack trace leak
    if (url.startsWith('/api/data')) {
      if (url.includes('trigger=error')) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('TypeError: Database connection failed at node_modules/db/driver.js:42');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not Found');
  });
}
