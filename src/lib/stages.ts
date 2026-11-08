/** The growth stages, in order: the homepage playbook's spine after "Idea". */
export const ventureStages = ['Product-Idea Fit', 'Product-Market Fit', 'Scale'] as const;
export type VentureStage = (typeof ventureStages)[number];
