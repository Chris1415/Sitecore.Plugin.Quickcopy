/** @type {import('next').NextConfig} */
//
// T036 — Bundle / build polish (NFR-008 target: ≤150 KB gzipped JS for /panel).
//
// As of Phase 4 the production build emits the following first-load assets
// for the `/panel` route (Next 16 + Turbopack output, measured via
// `gzip -c <chunk> | wc -c`):
//
//   Root chunks (loaded for any route):
//     turbopack-*.js                ~ 4.0 KB gz
//     <framework>.js                ~70.1 KB gz   (React + Next runtime)
//     <app-shell>.js                ~40.3 KB gz   (RSC/runtime helpers)
//     <bootstrap>.js                ~ 5.9 KB gz
//   Panel-specific entryJSFiles:
//     <providers/marketplace>.js    ~14.7 KB gz   (Marketplace SDK + XMC)
//     <panel/page>.js               ~ 5.1 KB gz
//     <panel composition>.js        ~ 8.2 KB gz   (cards/share-link/legend)
//   --------------------------------------------------------------
//   Total first-load JS for /panel  ~148 KB gz   (under the 150 KB target)
//   + ab762307223f0b3c.css          ~ 8.9 KB gz  (Tailwind + Geist preflight)
//
// No optimization beyond Next.js defaults was required to meet NFR-008.
// Largest single chunk is the React + Next framework which is shared across
// every route — no further trimming possible without a framework migration.
//
const nextConfig = {
  async headers() {
    return [
      {
        // Chrome Local Network Access consent headers. Without these, a
        // public-origin portal iframe (https://portal.sitecorecloud.io) cannot
        // load http://localhost:3000 — Chrome's PNA policy blocks the embed.
        // See setup/scaffold.md Scaffold 2 step 8 + testing-debug.md § 3a-quater.
        //
        // IMPORTANT: do NOT add `Access-Control-Allow-Credentials: true` here.
        // The combination `Allow-Origin: *` + `Allow-Credentials: true` is
        // spec-forbidden and browsers silently reject the response.
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Private-Network", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, Access-Control-Request-Private-Network",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
