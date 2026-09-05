import express from 'express';

export function createVulnerableApp() {
  const app = express();
  app.use(express.json());

  const processedOrders = new Set();

  // Flaw 1: Missing auth check
  app.get('/api/user/profile', (req, res) => {
    return res.status(200).json({ user: 'admin', profile: 'secret_data' });
  });

  // Flaw 2: Weak input validation (negative quantity allowed) & Concurrency race condition
  app.post('/api/checkout', (req, res) => {
    const { quantity, itemId } = req.body || {};
    const idempotencyKey = req.headers['x-idempotency-key'];

    // Flaw 2a: Accepts negative values
    if (quantity !== undefined && quantity < 0) {
      return res.status(200).json({ status: 'purchased', quantity });
    }

    // Flaw 2b: Race condition (does not properly lock idempotency key)
    if (idempotencyKey) {
      if (processedOrders.has(idempotencyKey)) {
        return res.status(409).json({ error: 'Duplicate request' });
      }
      processedOrders.add(idempotencyKey);
    }

    return res.status(200).json({ status: 'success', itemId });
  });

  // Flaw 3: Leaks raw stack trace on error
  app.get('/api/data', (req, res) => {
    if (req.query.trigger === 'error') {
      try {
        throw new TypeError('Database connection failed at node_modules/db/driver.js:42');
      } catch (err) {
        return res.status(500).send(err.stack);
      }
    }
    return res.json({ ok: true });
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createVulnerableApp();
  app.listen(3000, () => console.log('Vulnerable Shop running on http://localhost:3000'));
}
