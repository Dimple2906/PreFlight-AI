import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Vulnerable Shop API'));
app.listen(3000);
