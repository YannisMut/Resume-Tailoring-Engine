import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorMiddleware } from './middleware/error.middleware.js';
import { analyzeRouter } from './routes/analyze.route.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;
const WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? 'http://localhost:3000';

// Security headers
app.use(helmet());

// CORS — apps are on different origins in dev
app.use(cors({ origin: WEB_ORIGIN }));

// JSON body parser for /api/generate (ResumeStructure round-trip)
// Limit to 1mb — ResumeStructure is a JSON tree, not a file upload
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', analyzeRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Error middleware MUST be registered last — it catches errors from all routes above
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

export default app;
