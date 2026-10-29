import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything in this app is per-user and changes constantly, so pages render
  // on every request. Cache Components is left off on purpose.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // CSV imports go through a server action (capped at 5 MB in code). Creative files
    // never do: the browser uploads them straight to storage.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
