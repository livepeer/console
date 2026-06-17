import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/explore", "/network", "/models", "/login", "/signup"],
      disallow: ["/home", "/calls", "/usage", "/keys", "/settings"],
    },
    sitemap: "https://dashboard.livepeer.org/sitemap.xml",
  };
}
