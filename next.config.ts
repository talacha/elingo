import type { NextConfig } from "next";

// Verified empirically (loaded the app under this CSP and inspected the console):
// Next.js 16's App Router emits several inline <script> tags for RSC hydration data
// on every page, each with a different hash per build — 'unsafe-inline' is required
// for script-src unless/until we adopt per-request nonces. Without it the app doesn't
// render at all.
const connectSrc = ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"];
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  connectSrc.push(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

const nextConfig: NextConfig = {
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          // Content Security Policy: permits Google Fonts, same-origin API calls,
          // and the configured Supabase project (if any). Self-review before tightening.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; ` + // unsafe-inline: RSC hydration scripts (see comment above); unsafe-eval: dev-only, React's HMR debugging (never used in production)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; " +
              `connect-src ${connectSrc.join(" ")}; ` +
              "img-src 'self' data: https:; " +
              // M6: el audio de /api/speech (Fish Audio) se reproduce desde un blob: URL; sin esto
              // cae a default-src 'self', que SÍ bloquea blob: (verificado empíricamente).
              "media-src 'self' blob:; " +
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
          // Restrict permissions: disable camera, geolocation, accelerometer, gyroscope.
          // Microphone is scoped to this origin only (M6 voice input, T-054) — camera stays
          // disabled: image capture uses a plain <input type=file capture> (native OS picker),
          // which doesn't need a live in-page camera stream.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), " +
              "microphone=(self), " +
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
