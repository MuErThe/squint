import type { NextConfig } from "next";

// GitHub Pages serves static files only. `output: 'export'` makes `next build`
// emit a fully static `out/` directory we can publish.
//
// If you deploy under a sub-path like https://<user>.github.io/<repo>/, set the
// repo name as BASE_PATH at build time so all asset URLs resolve correctly:
//   BASE_PATH=/squint npm run build
// For a custom domain (root path) leave BASE_PATH unset.
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Expose the base path to client code that builds asset URLs manually
  // (e.g. lib/audio/sfx.ts) — `basePath` itself isn't readable in the browser.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // GitHub Pages doesn't run image optimisation; disable to keep paths static.
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
