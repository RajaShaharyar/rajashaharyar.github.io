import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Ventures: one MDX file per venture in src/content/ventures, all rendered
 * by one route (src/pages/ventures/[slug].astro). Adding a venture later is
 * a new file, not new code.
 */
const ventures = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/ventures' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number().int(),
    status: z.enum(['stub', 'draft', 'published']),
    phase: z.number().int(),
  }),
});

/** Pages that can list a Recognition-log item (the log's "Shown on" column). */
export const recognitionPages = [
  'competitions-awards',
  'programmes',
  'partnerships',
  'speaking-events',
  'education',
  'my-story',
  'beyond-work',
  'asaanbill',
  'tapit',
] as const;

/**
 * Recognition log: the single content source for the four Recognition pages,
 * Education and the My story timeline. Validated at build time.
 */
const recognition = defineCollection({
  loader: file('src/content/recognition.json'),
  schema: z.object({
    date: z.string(),
    dateISO: z
      .string()
      .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
      .nullable(),
    item: z.string(),
    shownOn: z.array(z.enum(recognitionPages)).min(1),
    shownOnNote: z.string().optional(),
    venture: z.string().nullable(),
    evidence: z.array(
      z.object({
        source: z.string(),
        file: z.string().nullable(),
        note: z.string().optional(),
      }),
    ),
    note: z.string().optional(),
    /** Missing facts, each starting with "TODO:". Kept in the data, never shown on the site. */
    todo: z.array(z.string().startsWith('TODO:')).optional(),
    toConfirm: z.array(z.string()),
  }),
});

export const collections = { ventures, recognition };
