import { z } from 'zod';

export const TextStyleSchema = z.object({
  fontName: z.string(),
  fontSize: z.number(),              // half-points (OOXML): 24 = 12pt
  bold: z.boolean(),
  italic: z.boolean(),
  color: z.string(),                 // hex "#1a1a1a"
  lineSpacingPt: z.number().optional(),
  spaceBefore: z.number().optional(),
  spaceAfter: z.number().optional(),
});

export const BulletSchema = z.object({
  id: z.string(),                    // deterministic: "experience-0-item-0-bullet-2"
  text: z.string(),                  // raw text without leading "•" or "-"
  style: TextStyleSchema,
});

export const SectionItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  titleStyle: TextStyleSchema.optional(),
  subtitle: z.string().optional(),
  subtitleStyle: TextStyleSchema.optional(),
  bullets: z.array(BulletSchema),
});

export const SectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  headingStyle: TextStyleSchema,
  items: z.array(SectionItemSchema),
});

export const ResumeStructureSchema = z.object({
  meta: z.object({
    pageWidth: z.number(),
    pageHeight: z.number(),
    marginTop: z.number(),
    marginBottom: z.number(),
    marginLeft: z.number(),
    marginRight: z.number(),
  }),
  sections: z.array(SectionSchema),
});

export type TextStyle = z.infer<typeof TextStyleSchema>;
export type Bullet = z.infer<typeof BulletSchema>;
export type SectionItem = z.infer<typeof SectionItemSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type ResumeStructure = z.infer<typeof ResumeStructureSchema>;
