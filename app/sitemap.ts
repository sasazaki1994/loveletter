import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const staticLastModified = new Date("2026-03-03");

  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${siteUrl}/privacy`, lastModified: staticLastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified: staticLastModified, changeFrequency: "monthly", priority: 0.3 },
  ];
}
