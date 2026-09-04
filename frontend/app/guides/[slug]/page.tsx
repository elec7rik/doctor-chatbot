import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuide, allGuideSlugs } from "@/lib/guides";
import { GuideArticle } from "@/components/GuideArticle";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return allGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: g.meta.title,
    description: g.meta.description,
    keywords: g.meta.keywords,
    alternates: { canonical: `/guides/${slug}` },
    openGraph: { type: "article", title: g.title, description: g.meta.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  return <GuideArticle guide={g} />;
}
