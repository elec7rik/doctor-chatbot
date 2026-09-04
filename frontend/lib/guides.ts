import { GUIDES, BY_SLUG, type Guide } from "@/content/guides/index";

export type GuideDoc = Guide;

export function allGuides(): readonly GuideDoc[] { return GUIDES; }
export function allGuideSlugs(): string[] { return GUIDES.map((g) => g.slug); }
export function getGuide(slug: string): GuideDoc | undefined { return BY_SLUG[slug]; }
