import { z } from 'zod';

export const RewrittenBulletSchema = z.object({
  id: z.string(),
  original: z.string(),
  rewritten: z.string(),
  approved: z.boolean().default(false),
});

export type RewrittenBullet = z.infer<typeof RewrittenBulletSchema>;
