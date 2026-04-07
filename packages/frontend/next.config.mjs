/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The frontend reads from the backend in two contexts:
  //
  //   1. Dev (pnpm -C packages/frontend dev): backend runs on
  //      localhost:3001. We rewrite /api/v1/* to it so the browser
  //      sees same-origin and we don't need CORS.
  //
  //   2. Prod (Vercel): backend runs on api.prevblock.com behind
  //      nginx + Let's Encrypt on a separate box. Set
  //      BACKEND_INTERNAL_URL=https://api.prevblock.com in the
  //      Vercel project's environment variables and the same
  //      rewrite rule forwards there. Server components also use
  //      this URL via lib/api.ts when running on Vercel's edge/node
  //      runtime.
  //
  // The single env var works for both because Next does the rewrite
  // server-side, never exposing the backend URL to the client.
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
  transpilePackages: ["@prevblock/shared"],
};

export default nextConfig;
