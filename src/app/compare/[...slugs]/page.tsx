"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { CompareView } from "@/components/compare/CompareView";
import type { ComparePanel, CompareResponse } from "@/app/api/v1/compare/route";

const MAX_SLUGS = 4;
const MIN_SLUGS = 2;

export default function ComparePage() {
  const params = useParams();

  // Next.js catch-all gives slugs as string[] or string
  const rawSlugs = params?.slugs;
  const slugs: string[] = Array.isArray(rawSlugs)
    ? rawSlugs
    : rawSlugs
    ? [rawSlugs]
    : [];

  const isValid = slugs.length >= MIN_SLUGS && slugs.length <= MAX_SLUGS;

  const [panels, setPanels] = useState<ComparePanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValid) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const query = slugs.join(",");
    fetch(`/api/v1/compare?slugs=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json() as Promise<CompareResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setPanels(data.panels ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load comparison";
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the slug set changes (router navigation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join(","), isValid]);

  // Render not-found state after hooks (rules of hooks: no early returns before hooks)
  if (!isValid) {
    notFound();
  }

  return (
    <CompareView
      slugs={slugs}
      panels={panels}
      loading={loading}
      error={error}
    />
  );
}
