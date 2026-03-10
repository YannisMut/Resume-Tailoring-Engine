import { Router } from 'express';
import { uploadMiddleware } from '../middleware/upload.middleware.js';
import { parsePdf } from '../services/pdf.service.js';

export const analyzeRouter = Router();

// POST /analyze — accepts a multipart resume upload, returns a validated ResumeStructure JSON.
// No try/catch needed: Express 5 propagates async rejections to errorMiddleware automatically.
analyzeRouter.post('/analyze', ...uploadMiddleware, async (req, res) => {
  const resume = await parsePdf(req.file!.buffer);
  res.json(resume);
});
