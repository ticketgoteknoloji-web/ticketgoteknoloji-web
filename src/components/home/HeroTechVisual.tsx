'use client';

import Image from 'next/image';

/** Spoke angles matching the ecosystem hex layout. */
const SPOKES = [
  { angle: -90, delay: '0s' },
  { angle: -30, delay: '0.35s' },
  { angle: 30, delay: '0.7s' },
  { angle: 90, delay: '1.05s' },
  { angle: 150, delay: '1.4s' },
  { angle: 210, delay: '1.75s' },
] as const;

const CX = 320;
const CY = 178;
const INNER_R = 52;
const OUTER_R = 128;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + Math.cos(rad) * radius,
    y: CY + Math.sin(rad) * radius,
  };
}

function FlowOverlay() {
  return (
    <svg
      className="hero-tech-flow-layer"
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hero-tech-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <filter id="hero-tech-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="hero-tech-core-pulse" cx={CX} cy={CY} r="46" fill="url(#hero-tech-core-glow)" />

      {SPOKES.map(({ angle, delay }, index) => {
        const inner = polar(angle, INNER_R);
        const outer = polar(angle, OUTER_R);
        const mid = polar(angle, (INNER_R + OUTER_R) / 2);
        return (
          <g key={angle}>
            <line
              className="hero-tech-beam"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              style={{ animationDelay: delay }}
            />
            <line
              className="hero-tech-beam-flow"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              style={{ animationDelay: delay }}
              filter="url(#hero-tech-glow)"
            />
            <circle className="hero-tech-packet" r="3.2" filter="url(#hero-tech-glow)">
              <animateMotion
                dur={`${2.4 + (index % 3) * 0.25}s`}
                begin={delay}
                repeatCount="indefinite"
                path={`M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`}
              />
            </circle>
            <circle className="hero-tech-packet hero-tech-packet--return" r="2.2" filter="url(#hero-tech-glow)">
              <animateMotion
                dur={`${2.8 + (index % 2) * 0.3}s`}
                begin={`${0.9 + index * 0.2}s`}
                repeatCount="indefinite"
                path={`M ${outer.x} ${outer.y} L ${inner.x} ${inner.y}`}
              />
            </circle>
            <circle
              className="hero-tech-node-pulse"
              cx={outer.x}
              cy={outer.y}
              r="4"
              style={{ animationDelay: delay }}
            />
            <circle
              className="hero-tech-mid-spark"
              cx={mid.x}
              cy={mid.y}
              r="2"
              style={{ animationDelay: `calc(${delay} + 0.4s)` }}
            />
          </g>
        );
      })}

      <circle className="hero-tech-hub-ring" cx={CX} cy={CY} r="38" />
    </svg>
  );
}

function TechFace({ className, withFlow = false }: { className: string; withFlow?: boolean }) {
  return (
    <div className={className}>
      <Image
        src="/images/hero/technology-ecosystem-nobg.png"
        alt=""
        width={640}
        height={360}
        className="hero-tech-image w-full max-w-[620px] object-contain"
        priority
        aria-hidden
      />
      {withFlow ? <FlowOverlay /> : null}
    </div>
  );
}

/**
 * Hero ecosystem visual — planet-style yaw spin (rotateY)
 * with continuous data-flow pulses on the spokes.
 */
export function HeroTechVisual() {
  return (
    <div className="hero-tech-visual mb-6 flex w-full min-w-0 items-center justify-center lg:justify-start">
      <div className="hero-tech-stage">
        <div className="hero-tech-orbit" role="img" aria-label="TicketGo Teknoloji dijital yazılım ve entegrasyon ekosistemi">
          <TechFace className="hero-tech-face hero-tech-face--front" withFlow />
          <TechFace className="hero-tech-face hero-tech-face--back" />
        </div>
      </div>
    </div>
  );
}
