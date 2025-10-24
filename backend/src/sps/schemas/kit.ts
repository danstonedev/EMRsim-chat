import { z } from 'zod';

export const KitChunkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  text: z.string().min(1),
  tags: z.array(z.string()).optional(),
  chunk_type: z.enum(['fact', 'guardrail', 'education', 'exam', 'imaging', 'ground_truth', 'other']).optional(),
  roles: z.array(z.string()).optional(),
  phases: z.array(z.string()).optional(),
  weight: z.number().min(0).max(1).optional(),
  media_ids: z.array(z.string()).optional(),
  audiences: z.array(z.enum(['student', 'faculty'])).optional(),
  source: z.string().optional(),
  citations: z.array(z.string()).optional(),
  links: z.array(z.string().url()).optional(),
});

export const ScenarioKitSchema = z.object({
  case_id: z.string().min(1),
  version: z.number().int().positive().optional(),
  provenance: z
    .object({
      sources: z.array(z.string()).optional(),
      reviewers: z.array(z.string()).optional(),
      last_reviewed: z.string().optional(),
    })
    .optional(),
  chunks: z.array(KitChunkSchema).min(1),
});

export type KitChunk = z.infer<typeof KitChunkSchema>;
export type ScenarioKit = z.infer<typeof ScenarioKitSchema>;
