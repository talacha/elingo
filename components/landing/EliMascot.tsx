/** Mascota de ELI: una lucecita que respira, parpadea y saluda. Las animaciones se apagan con prefers-reduced-motion. */
export function EliMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 280"
      role="img"
      aria-label="ELI, una lucecita amigable que sonríe y saluda con la mano"
      className={className}
    >
      <defs>
        <radialGradient id="eli-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopOpacity="0.5" className="[stop-color:var(--sun)]" />
          <stop offset="1" stopOpacity="0" className="[stop-color:var(--sun)]" />
        </radialGradient>
      </defs>
      <circle
        cx="130"
        cy="120"
        r="118"
        fill="url(#eli-glow)"
        className="origin-center animate-breathe [transform-box:fill-box] motion-reduce:animate-none"
      />
      <g className="fill-sun-deep">
        <path d="M44 46 L47.5 54.5 L56 58 L47.5 61.5 L44 70 L40.5 61.5 L32 58 L40.5 54.5 Z" />
        <path d="M224 35 L226.6 41.4 L233 44 L226.6 46.6 L224 53 L221.4 46.6 L215 44 L221.4 41.4 Z" />
        <path d="M236 139 L238 144 L243 146 L238 148 L236 153 L234 148 L229 146 L234 144 Z" />
      </g>
      <g className="origin-bottom-right animate-wave [transform-box:fill-box] motion-reduce:animate-none">
        <path
          d="M64 170 Q 30 150 34 112"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          className="stroke-sun-deep"
        />
        <circle cx="34" cy="110" r="11" className="fill-sun-deep" />
      </g>
      <path
        d="M190 172 Q 224 186 232 214"
        fill="none"
        strokeWidth="14"
        strokeLinecap="round"
        className="stroke-sun-deep"
      />
      <circle cx="232" cy="215" r="11" className="fill-sun-deep" />
      <circle cx="130" cy="118" r="82" className="fill-sun" />
      <rect x="98" y="182" width="64" height="26" className="fill-sun" />
      <ellipse
        cx="100"
        cy="76"
        rx="16"
        ry="24"
        transform="rotate(-25 100 76)"
        className="fill-white opacity-35"
      />
      <rect x="94" y="206" width="72" height="44" rx="14" className="fill-base" />
      <rect x="102" y="218" width="56" height="5" rx="2.5" className="fill-base-line" />
      <rect x="102" y="230" width="56" height="5" rx="2.5" className="fill-base-line" />
      <rect x="114" y="248" width="32" height="14" rx="7" className="fill-base" />
      <g className="origin-center animate-blink [transform-box:fill-box] motion-reduce:animate-none">
        <circle cx="106" cy="112" r="9" className="fill-face" />
        <circle cx="154" cy="112" r="9" className="fill-face" />
        <circle cx="109" cy="108" r="3" className="fill-white" />
        <circle cx="157" cy="108" r="3" className="fill-white" />
      </g>
      <circle cx="88" cy="134" r="9" className="fill-peach opacity-75" />
      <circle cx="172" cy="134" r="9" className="fill-peach opacity-75" />
      <path
        d="M110 138 Q 130 158 150 138"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-face"
      />
    </svg>
  );
}
