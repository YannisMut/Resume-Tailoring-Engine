import { z } from 'zod';
import { ResumeStructureSchema } from './resume.js';
import { RewrittenBulletSchema } from './bullet.js';

export const AnalysisResultSchema = z.object({
  score: z.number().min(0).max(100),
  gaps: z.array(z.string()),
  rewrites: z.array(RewrittenBulletSchema),
  resumeStructure: ResumeStructureSchema,
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
