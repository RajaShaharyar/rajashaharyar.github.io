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

/** Result badges. Counters on the Recognition pages are computed from these. */
export const recognitionBadges = ['Winner', 'Top 3', 'Award', 'Programme', 'Office', 'MOU', 'Talk', 'Event', 'Represented', 'Media'] as const;

/** A text field that may still be missing: a "TODO: …" string is kept in the data and hidden on the site. */
const text = z.string().min(1).optional();

/**
 * Recognition log: the single content source for the overview, the four
 * Recognition pages and the homepage carousel. Validated at build time.
 */
const recognition = defineCollection({
  loader: file('src/content/recognition.json'),
  schema: z.object({
    category: z.enum(['competition', 'award', 'programme', 'office', 'partnership', 'talk', 'event', 'represented', 'media', 'milestone', 'education']),
    /** null = not shown on the Recognition pages (a milestone or education row) */
    badge: z.enum(recognitionBadges).nullable(),
    title: z.string(),
    subtitle: text,
    organiser: text,
    venue: text,
    /** Display date, e.g. "Jun 2023", "Mar 2023 – Feb 2024", "2025–26" */
    date: z.string(),
    /** For sorting; null when only a range like "2025–26" is known */
    dateISO: z
      .string()
      .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
      .nullable(),
    prize: text,
    detail: text,
    summary: text,
    role: text,
    selectivity: text,
    gave: text,
    purpose: text,
    recognisedBy: text,
    venture: z.object({ name: z.string(), href: z.string().startsWith('/') }).nullable(),
    photos: z.array(z.object({ file: z.string().endsWith('.webp'), caption: text, source: z.string() })),
    links: z.array(z.object({ label: z.string(), href: z.url() })).optional(),
    shownOn: z.array(z.enum(recognitionPages)).min(1),
    /** Display order within its section of a Recognition page (lower first) */
    order: z.number().int().positive().optional(),
    /** One of the three highlight cards on /recognition */
    highlight: z.object({ order: z.number().int().positive(), line: z.string() }).optional(),
    note: text,
    /** Missing facts, each starting with "TODO:". Kept in the data, never shown on the site. */
    todo: z.array(z.string().startsWith('TODO:')).optional(),
    toConfirm: z.array(z.string()),
  }),
});

export const collections = { ventures, recognition };
