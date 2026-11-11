import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ventureStages } from './lib/stages';


const link = z.object({ label: z.string(), href: z.string() });
const metric = z.object({ value: z.string(), label: z.string() });
/** Shared by every venture file */
const base = {
  title: z.string(),
  /** Meta description */
  summary: z.string(),
  order: z.number().int(),
  status: z.enum(['draft', 'published']),
  phase: z.number().int(),
  /** Missing facts, each starting with "TODO:". Kept in the data, never rendered. */
  todo: z.array(z.string().startsWith('TODO:')).default([]),
};
const stage = z.object({
  text: z.string(),
  /** Wording used once a missing fact is filled in (Tapit's pre-sales amount) */
  textWithPreSales: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  source: link.optional(),
});

/** Shared by case studies and role stories */
const limitations = z
  .array(z.object({ constraint: z.string(), whyItMattered: z.string(), tried: z.string(), worked: z.string(), result: z.string() }))
  .default([]);
const results = z.object({ tiles: z.array(metric).min(1), definition: z.string().optional() }).optional();

/**
 * A case study (AsaanBill, Tapit, Ladenza), rendered by VentureLayout. Every
 * optional block renders only when it has data; a value that is still a
 * "TODO: …" string is treated as missing.
 * The discriminator is `kind`, not `layout`: MDX reads a frontmatter `layout`
 * as the path of a layout component to wrap the file in.
 */
const caseStudy = z.object({
  ...base,
  kind: z.literal('case-study'),
  snapshot: z.object({
    role: z.string(),
    dates: z.string(),
    team: z.string().optional(),
    stage: z.enum(ventureStages),
    metrics: z.array(metric).max(3),
    outcome: z.string(),
  }),
  /** "Visit … ↗" in the snapshot; an href that is still TODO is not shown */
  external: link.optional(),
  problem: z.object({
    text: z.string(),
    /** Wording for Raja to revise (published as is) */
    draft: z.boolean().default(false),
    source: link.optional(),
    /** The customer pain in Raja's words, when it differs from the product description */
    pain: z.string().optional(),
  }),
  stages: z.object({ ideaFit: stage, marketFit: stage, scale: stage }),
  /** Tapit's prototype pre-sales; the amount shows only once the currency is filled in */
  preSales: z.object({ amount: z.string(), currency: z.string() }).optional(),
  verticals: z.array(z.object({ name: z.string(), text: z.string() })).default([]),
  clients: z.object({ text: z.string(), source: link }).optional(),
  spotlight: z
    .object({
      heading: z.string(),
      intro: z.string(),
      rows: z.array(z.object({ item: z.string(), when: z.string(), means: z.string(), source: z.url().optional() })).min(1),
    })
    .optional(),
  journey: z
    .object({
      heading: z.string(),
      steps: z.array(z.object({ label: z.string(), owner: z.string(), accent: z.boolean().default(false) })).min(1),
      goesLiveWith: z.array(z.string()).default([]),
      caption: z.string().optional(),
      refundSteps: z.string().optional(),
    })
    .optional(),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
  limitations,
  contributions: z.array(z.object({ area: z.string(), raja: z.string(), others: z.string() })).default([]),
  results,
  lessons: z.array(z.string()).default([]),
  /** recognition.json ids whose photos make the evidence gallery */
  evidenceIds: z.array(z.string()).default([]),
  press: z.array(link).default([]),
  next: link.optional(),
});

/**
 * A lighter venture page (Dressup, Sonic AI Engine), rendered by VentureLayout
 * in the same look as a case study. Company, product, summary, Raja's role,
 * dates, location and "What I did" all come from one cv.json experience entry.
 * The optional blocks render only once they are filled in (not "TODO: …").
 * No stage badge and no metric: none exists for these products.
 */
const roleStory = z.object({
  ...base,
  kind: z.literal('role-story'),
  /** cv.json → experience id */
  experienceId: z.string(),
  /** Product link, shown under "The product" once the href is real */
  external: link.optional(),
  problem: z.object({ text: z.string(), draft: z.boolean().default(false) }).optional(),
  limitations,
  results,
  lessons: z.array(z.string()).default([]),
  /** recognition.json ids whose photos make the evidence gallery */
  evidenceIds: z.array(z.string()).default([]),
  next: link.optional(),
  cta: z.object({ heading: z.string(), link }),
});

/** A page of role cards (Other ventures), built from cv.json. */
const roles = z.object({
  ...base,
  kind: z.literal('roles'),
  intro: z.string(),
  /** cv.json experience ids, in display order; the first is the wide featured card */
  roles: z.array(z.string()).min(1),
  /** cv.json → otherVentures ids, shown as cards after the roles (e.g. Mustahiq) */
  otherVentures: z.array(z.string()).default([]),
  featuredNote: z.string().optional(),
  /** Closing call to action; or yoursNext: true for the shared "Yours next?" block (home.json → ventures.yoursNext) */
  cta: z.object({ heading: z.string(), link }).optional(),
  yoursNext: z.boolean().default(false),
});

/**
 * Ventures: one MDX file per venture in src/content/ventures, all rendered by
 * one route (src/pages/ventures/[slug].astro). Adding a venture later is a new
 * file, not new code.
 */
const ventures = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/ventures' }),
  schema: z.discriminatedUnion('kind', [caseStudy, roleStory, roles]),
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
    /** What the badge reads on cards and the carousel, when it differs from the counted badge (e.g. "1st prize" for a Winner) */
    badgeLabel: text,
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
