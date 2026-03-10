import { Router } from 'express';
import { z } from 'zod';
import { uploadMiddleware } from '../middleware/upload.middleware.js';
import { parsePdf } from '../services/pdf.service.js';
import { JdTooLongError } from '../middleware/error.middleware.js';
import { analyzeResume } from '../services/analysis.service.js';

export const analyzeRouter = Router();

const AnalyzeRequestSchema = z.object({
  jobDescription: z.string().trim().min(1).max(5000),
});

// POST /analyze — accepts a multipart resume upload + jobDescription field,
// validates JD before parsing the PDF (fail fast on cheap check), then returns
// a full AnalysisResult (score, gaps, rewrites, resumeStructure).
// No try/catch needed: Express 5 propagates async rejections to errorMiddleware automatically.
analyzeRouter.post('/analyze', ...uploadMiddleware, async (req, res) => {
  // Validate JD BEFORE parsePdf — fail fast on cheap check
  const parsed = AnalyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new JdTooLongError('Job description must be between 1 and 5,000 characters.');
  }

  const resume = await parsePdf(req.file!.buffer);
  const result = analyzeResume(resume, parsed.data.jobDescription);
  res.json(result);
});
