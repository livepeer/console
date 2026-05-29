import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/network", "/models", "/login", "/signup"],
      disallow: ["/home", "/jobs", "/usage", "/keys", "/settings"],
    },
    sitemap: "https://dashboard.livepeer.org/sitemap.xml",
  };
}
