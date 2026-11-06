import cvJson from '../content/cv.json';

/**
 * Typed access to cv.json, the one source for CV facts. The About pages read
 * from here (by id) so they can't drift from the CV page and the PDF.
 * Values starting with "TODO" are missing data: check them with isTodo()/filled()
 * from ./site and hide the field.
 */

export interface ExperienceRole {
  title: string;
  /** "YYYY-MM", "YYYY-MM-DD" or a "TODO: …" placeholder */
  start: string;
  end: string | null;
  bullets: string[];
}

export interface ExperienceItem {
  id: string;
  company: string;
  location: string;
  href: string;
  product?: string;
  summary?: string;
  roles: ExperienceRole[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  city: string;
  location: string;
  start: string;
  end: string;
  website?: string;
  finalYearProject: {
    title: string;
    description: string;
    award: string;
    awardDate: string;
    presentedAt?: string;
    recognitionIds: string[];
  };
  grade?: string;
}

export interface Programme {
  id: string;
  provider: string;
  providerFull?: string;
  name: string;
  mode?: string;
  year?: string;
  start: string;
  end: string | null;
  website?: string;
  image?: string;
  covered?: string;
  certificate?: string;
  venture?: string;
  note?: string;
  recognitionIds?: string[];
}

export interface SkillGroup {
  name: string;
  items: string[];
}

export interface Language {
  name: string;
  level: string;
}

interface Cv {
  experience: { items: ExperienceItem[] };
  education: { items: EducationItem[] };
  programmes: { items: Programme[] };
  skills: { groups: SkillGroup[] };
  languages: { items: Language[] };
}

export const cv = cvJson as unknown as Cv;

function byId<T extends { id: string }>(list: T[], id: string, what: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`${what} "${id}" is not in src/content/cv.json.`);
  return found;
}

export const getExperience = (id: string) => byId(cv.experience.items, id, 'Experience');
export const getEducation = (id: string) => byId(cv.education.items, id, 'Education item');
export const getProgramme = (id: string) => byId(cv.programmes.items, id, 'Programme');
