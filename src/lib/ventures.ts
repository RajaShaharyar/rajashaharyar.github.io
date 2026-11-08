import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { filled } from './site';

/**
 * Helpers for the ventures collection (src/content/ventures/*.mdx). Case-study
 * facts live only there: the CV reads Tapit's pre-sales from tapit.mdx.
 */

export type VentureEntry = CollectionEntry<'ventures'>;
export type CaseStudy = Extract<VentureEntry['data'], { kind: 'case-study' }>;
export type RolesPage = Extract<VentureEntry['data'], { kind: 'roles' }>;

/** "PKR 40K" once the currency is filled in; undefined while it is still a TODO. */
export function preSalesText(preSales?: { amount: string; currency: string }): string | undefined {
  const currency = filled(preSales?.currency);
  const amount = filled(preSales?.amount);
  return currency && amount ? `${currency} ${amount}` : undefined;
}

/** Tapit's prototype pre-sales, from tapit.mdx (one source for the venture page and the CV). */
export async function tapitPreSales(): Promise<string | undefined> {
  const tapit = await getEntry('ventures', 'tapit');
  return tapit?.data.kind === 'case-study' ? preSalesText(tapit.data.preSales) : undefined;
}

/** Every venture in menu order. */
export async function allVentures(): Promise<VentureEntry[]> {
  return (await getCollection('ventures')).sort((a, b) => a.data.order - b.data.order);
}
