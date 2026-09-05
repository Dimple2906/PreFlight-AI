import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(3000, () => {
    console.log('Healthy Node API server running on port 3000');
  });
}
