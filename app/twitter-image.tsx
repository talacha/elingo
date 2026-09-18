import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "ELI — Tutor Nexo";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  const sunColor = "#f7b32b";
  const sunDeepColor = "#d9960e";
  const baseColor = "#7a8797";
  const inkColor = "#1e2a44";
  const canvasColor = "#fffcf5";

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: canvasColor,
          width: 1200,
          height: 630,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: '"Fredoka", sans-serif',
          padding: "0 80px",
          boxSizing: "border-box",
        }}
      >
        {/* Background grid */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            opacity: 0.1,
          }}
          width="1200"
          height="630"
        >
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke={inkColor} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1200" height="630" fill="url(#grid)" />
        </svg>

        {/* Left content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 500,
            flex: 1,
          }}
        >
          {/* Tagline */}
          <div
            style={{
              fontSize: 24,
              color: inkColor,
              fontWeight: 500,
            }}
          >
            Para 6º de primaria
          </div>

          {/* Main headline */}
          <h1
            style={{
              fontSize: 92,
              fontWeight: 800,
              margin: 0,
              color: inkColor,
              lineHeight: 1.1,
            }}
          >
            ELI
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 36,
              color: inkColor,
              margin: 0,
              lineHeight: 1.3,
              fontWeight: 400,
            }}
          >
            Tu mentor de estudio que nunca te da la respuesta
          </p>
        </div>

        {/* Right side: Lightbulb */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <svg width="200" height="240" viewBox="0 0 130 180">
            {/* Outer glow */}
            <circle cx="65" cy="65" r="75" fill={sunColor} opacity="0.15" />

            {/* Main bulb */}
            <circle cx="65" cy="65" r="55" fill={sunColor} />

            {/* Shine/highlight */}
            <ellipse cx="50" cy="48" rx="18" ry="26" fill="white" opacity="0.25" />

            {/* Base/neck */}
            <rect x="55" y="115" width="20" height="18" fill={baseColor} />

            {/* Socket */}
            <rect x="50" y="132" width="30" height="20" rx="6" fill={baseColor} />
            <rect x="58" y="142" width="14" height="3" rx="1" fill="#5e6b7a" />
            <rect x="58" y="149" width="14" height="3" rx="1" fill="#5e6b7a" />
          </svg>
        </div>

        {/* Top left star */}
        <svg
          style={{
            position: "absolute",
            left: 80,
            top: 60,
            display: "flex",
          }}
          width="40"
          height="40"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={sunDeepColor}
          />
        </svg>

        {/* Bottom right star */}
        <svg
          style={{
            position: "absolute",
            right: 100,
            bottom: 80,
            display: "flex",
          }}
          width="28"
          height="28"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={sunDeepColor}
            opacity="0.7"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
