import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          // Content Security Policy: permits Google Fonts, same-origin API calls,
          // and optional Supabase connection. Self-review before tightening.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline'; " + // unsafe-inline for Next.js runtime
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; " +
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " + // provisional: add Supabase URLs if configured
              "img-src 'self' data: https:; " +
              "frame-ancestors 'none'",
          },
          // Prevent embedding in iframes
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Referrer policy: send only origin on cross-origin requests
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Restrict permissions: disable camera, microphone, geolocation, accelerometer, gyroscope
          {
            key: "Permissions-Policy",
            value:
              "camera=(), " +
              "microphone=(), " +
              "geolocation=(), " +
              "accelerometer=(), " +
              "gyroscope=(), " +
              "magnetometer=(), " +
              "usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
