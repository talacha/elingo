import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Puente temporal: la landing estática (public/landing.html) sigue viva en "/"
      // hasta que T-013 la sustituya por app/page.tsx.
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
    };
  },
};

export default nextConfig;
