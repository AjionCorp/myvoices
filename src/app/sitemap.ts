import type { MetadataRoute } from "next";
import { runSql, rowToObject, IS_MOCK } from "@/lib/spacetimedb/http-sql";

const TOPIC_COLUMNS = ["id", "slug", "title"];
const USER_COLUMNS = ["identity", "username"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://myvoice.app";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/help`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/developers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  if (IS_MOCK) return staticPages;

  try {
    const [topicResults, userResults] = await Promise.all([
      runSql("SELECT id, slug, title FROM topic"),
      runSql("SELECT identity, username FROM user_profile"),
    ]);

    const topicPages: MetadataRoute.Sitemap = (topicResults[0]?.rows ?? [])
      .map((r) => rowToObject(r, topicResults[0]?.schema, TOPIC_COLUMNS))
      .map((t) => ({
        url: `${baseUrl}/t/${t.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));

    const userPages: MetadataRoute.Sitemap = (userResults[0]?.rows ?? [])
      .map((r) => rowToObject(r, userResults[0]?.schema, USER_COLUMNS))
      .filter((u) => u.username)
      .map((u) => ({
        url: `${baseUrl}/u/${u.username}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    return [...staticPages, ...topicPages, ...userPages];
  } catch (err) {
    console.error("[sitemap]", err);
    return staticPages;
  }
}
