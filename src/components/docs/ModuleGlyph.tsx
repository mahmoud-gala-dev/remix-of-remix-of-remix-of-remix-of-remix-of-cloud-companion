import type { GlyphVariant } from "@/lib/docs-modules";

/**
 * Small animated SVG that expresses what a module does. Purely decorative —
 * each variant is drawn in code so no image assets are needed.
 */
export function ModuleGlyph({ variant, label }: { variant: GlyphVariant; label: string }) {
  return (
    <svg
      viewBox="0 0 160 96"
      className="h-24 w-full rounded-lg border border-border/50 bg-[oklch(0.19_0.04_255)]"
      role="img"
      aria-label={label}
    >
      <defs>
        <pattern id={`glyph-grid-${variant}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M16 0H0V16"
            fill="none"
            stroke="var(--chart-2)"
            strokeOpacity="0.12"
            strokeWidth="0.7"
          />
        </pattern>
      </defs>
      <rect width="160" height="96" fill={`url(#glyph-grid-${variant})`} />

      {variant === "flow" && (
        <g>
          <path
            d="M18 70 Q80 8 142 70"
            fill="none"
            stroke="var(--chart-3)"
            strokeOpacity="0.7"
            strokeWidth="1.6"
            strokeDasharray="5 8"
            className="team-flow-dash"
          />
          <circle cx="18" cy="70" r="6" fill="var(--chart-3)" fillOpacity="0.3" stroke="var(--chart-3)" />
          <circle cx="142" cy="70" r="6" fill="var(--chart-2)" fillOpacity="0.3" stroke="var(--chart-2)" />
          <circle r="3.2" fill="var(--chart-1)">
            <animateMotion dur="3s" repeatCount="indefinite" path="M18 70 Q80 8 142 70" />
          </circle>
        </g>
      )}

      {variant === "orbit" && (
        <g style={{ transformOrigin: "80px 48px" }}>
          <circle cx="80" cy="48" r="9" fill="var(--chart-2)" fillOpacity="0.35" stroke="var(--chart-2)" />
          <g className="team-flow-spin" style={{ transformOrigin: "80px 48px" }}>
            <circle cx="80" cy="48" r="30" fill="none" stroke="var(--chart-3)" strokeOpacity="0.35" strokeDasharray="4 6" />
            <circle cx="110" cy="48" r="4" fill="var(--chart-3)" />
            <circle cx="80" cy="48" r="18" fill="none" stroke="var(--chart-1)" strokeOpacity="0.3" strokeDasharray="3 5" />
            <circle cx="62" cy="48" r="3" fill="var(--chart-1)" />
          </g>
        </g>
      )}

      {variant === "bars" && (
        <g>
          {[
            { x: 26, h: 26, d: "0s" },
            { x: 54, h: 44, d: "0.2s" },
            { x: 82, h: 34, d: "0.4s" },
            { x: 110, h: 56, d: "0.6s" },
          ].map((bar) => (
            <rect
              key={bar.x}
              x={bar.x}
              width="16"
              y={78 - bar.h}
              height={bar.h}
              rx="3"
              fill="var(--chart-2)"
              fillOpacity="0.5"
            >
              <animate
                attributeName="height"
                values={`${bar.h * 0.4};${bar.h};${bar.h * 0.4}`}
                dur="2.6s"
                begin={bar.d}
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values={`${78 - bar.h * 0.4};${78 - bar.h};${78 - bar.h * 0.4}`}
                dur="2.6s"
                begin={bar.d}
                repeatCount="indefinite"
              />
            </rect>
          ))}
          <line x1="18" y1="78" x2="142" y2="78" stroke="var(--chart-3)" strokeOpacity="0.5" />
        </g>
      )}

      {variant === "grid" && (
        <g>
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={26 + col * 28}
                y={20 + row * 22}
                width="20"
                height="14"
                rx="3"
                fill="var(--chart-2)"
                fillOpacity="0.25"
                stroke="var(--chart-2)"
                strokeOpacity="0.4"
              >
                <animate
                  attributeName="fill-opacity"
                  values="0.15;0.6;0.15"
                  dur="3s"
                  begin={`${(row * 4 + col) * 0.15}s`}
                  repeatCount="indefinite"
                />
              </rect>
            )),
          )}
        </g>
      )}

      {variant === "pulse" && (
        <g>
          {[14, 24, 34].map((r, i) => (
            <circle
              key={r}
              cx="80"
              cy="48"
              r={r}
              fill="none"
              stroke="var(--chart-1)"
              strokeOpacity="0.4"
              className="team-flow-pulse"
              style={{ transformOrigin: "80px 48px", animationDelay: `${i * 0.4}s` }}
            />
          ))}
          <circle cx="80" cy="48" r="7" fill="var(--chart-1)" fillOpacity="0.6" />
        </g>
      )}
    </svg>
  );
}

export default ModuleGlyph;
