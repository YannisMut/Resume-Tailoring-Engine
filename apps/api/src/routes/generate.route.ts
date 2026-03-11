import { Router } from 'express';
import { z } from 'zod';
import { ResumeStructureSchema, RewrittenBulletSchema } from '@resume/types';
import { generateDocx } from '../services/docx.service.js';

export const generateRouter = Router();

const GenerateRequestSchema = z.object({
  resumeStructure: ResumeStructureSchema,
  bullets: z.array(RewrittenBulletSchema),
});

// POST /generate — receives ResumeStructure + approved bullets, returns DOCX binary.
// No try/catch — Express 5 propagates async throws to errorMiddleware automatically.
generateRouter.post('/generate', async (req, res) => {
  const parsed = GenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', message: 'Invalid request body.' });
    return;
  }
  const buffer = await generateDocx(parsed.data.resumeStructure, parsed.data.bullets);
  res
    .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .setHeader('Content-Disposition', 'attachment; filename="resume_tailored.docx"')
    .send(buffer);
});
