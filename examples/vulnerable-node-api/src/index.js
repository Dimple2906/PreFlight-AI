import express from 'express';
const app = express();
app.use(express.json());
// Hardcoded credential leak (triggers DEPLOY-SECRETS-001)
const HARDCODED_AWS_KEY = 'AKIA1234567890123456';
app.get('/api/admin/metrics', (_req, res) => {
    // Vulnerable unauthenticated route
    res.json({ status: 'ok', awsKey: HARDCODED_AWS_KEY });
});
if (process.env.NODE_ENV !== 'test') {
    app.listen(3000, () => {
        console.log('Vulnerable Node API server running on port 3000');
    });
}
//# sourceMappingURL=index.js.map