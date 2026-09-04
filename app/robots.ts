import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/explore", "/network", "/models", "/auth/login"],
      disallow: ["/home", "/install", "/calls", "/usage", "/keys"],
    },
    sitemap: "https://earlyaccess.livepeer.org/sitemap.xml",
  };
}
