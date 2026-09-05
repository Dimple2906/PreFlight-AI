import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Hardcoded secret credential in source code (triggers DEPLOY-SECRETS-001)
const AWS_SECRET_KEY = 'AKIA1234567890123456';
const GEMINI_KEY = 'AIzaSy123456789012345678901234567890123';

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Unauthenticated sensitive endpoint
app.get('/api/admin/config', (_req: Request, res: Response) => {
  res.json({ awsKey: AWS_SECRET_KEY, geminiKey: GEMINI_KEY });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(3000, () => {
    console.log('Fixture Demo server running on port 3000');
  });
}
