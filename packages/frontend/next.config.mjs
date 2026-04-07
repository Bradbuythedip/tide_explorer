/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend lives on :3001. In dev we rewrite /api/* to it so the
  // browser doesn't need CORS and the dev experience matches prod
  // (where nginx does the same rewrite). Override in .env.local:
  //   NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3001
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
  // Transpile the shared workspace package — Next would otherwise skip
  // node_modules and we'd have to build shared separately every change.
  transpilePackages: ["@prevblock/shared"],
};

export default nextConfig;
