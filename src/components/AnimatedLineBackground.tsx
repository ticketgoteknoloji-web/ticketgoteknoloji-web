'use client';

/**
 * AnimatedLineBackground
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a fixed, full-viewport layer of horizontal lines that animate
 * right-to-left (sağdan sola). The layer sits at z-index 0 with
 * pointer-events: none so it never blocks interaction.
 *
 * Lines use WhatsApp-green tones (rgba(37,211,102,…)) at very low opacity —
 * purely decorative, never interfering with text contrast.
 *
 * Performance notes:
 * – All motion is CSS `transform: translateX` — GPU-composited, no layout.
 * – Only 16 DOM nodes total.
 * – `will-change: transform` on each line.
 * – `prefers-reduced-motion` handled via CSS (@media).
 */

type LineConfig = {
  /** vertical position as % of viewport */
  top: string;
  /** horizontal start position as % — offset so lines enter from the right */
  left: string;
  /** data-w: s | m | l | xl → controls CSS width */
  w: 's' | 'm' | 'l' | 'xl';
  /** animation duration in seconds */
  dur: number;
  /** animation delay in seconds (negative = already mid-flight) */
  delay: number;
  /** data-o: lo | md | hi → opacity layer */
  o: 'lo' | 'md' | 'hi';
  /** data-c: a | b | c → color variant */
  c: 'a' | 'b' | 'c';
  /** data-t: 1 | 2 → thickness */
  t?: '2';
};

const lines: LineConfig[] = [
  // Row 1 — hero zone
  { top: '6%',  left: '110%', w: 'xl', dur: 18, delay: -4,  o: 'md', c: 'a' },
  { top: '8%',  left: '95%',  w: 'm',  dur: 12, delay: -2,  o: 'lo', c: 'b' },
  // Row 2
  { top: '15%', left: '105%', w: 'l',  dur: 14, delay: -7,  o: 'hi', c: 'c', t: '2' },
  { top: '17%', left: '115%', w: 's',  dur: 9,  delay: -1,  o: 'lo', c: 'b' },
  // Row 3
  { top: '28%', left: '100%', w: 'm',  dur: 20, delay: -11, o: 'md', c: 'a' },
  { top: '30%', left: '108%', w: 'xl', dur: 16, delay: -3,  o: 'lo', c: 'b' },
  // Row 4
  { top: '42%', left: '103%', w: 'l',  dur: 13, delay: -6,  o: 'hi', c: 'c' },
  { top: '44%', left: '92%',  w: 's',  dur: 10, delay: -9,  o: 'lo', c: 'a' },
  // Row 5
  { top: '55%', left: '112%', w: 'm',  dur: 17, delay: -2,  o: 'md', c: 'b', t: '2' },
  { top: '57%', left: '98%',  w: 'xl', dur: 22, delay: -14, o: 'lo', c: 'a' },
  // Row 6
  { top: '66%', left: '106%', w: 's',  dur: 11, delay: -5,  o: 'hi', c: 'c' },
  { top: '68%', left: '100%', w: 'l',  dur: 19, delay: -8,  o: 'lo', c: 'b' },
  // Row 7
  { top: '78%', left: '115%', w: 'xl', dur: 15, delay: -1,  o: 'md', c: 'a' },
  { top: '80%', left: '95%',  w: 'm',  dur: 12, delay: -10, o: 'lo', c: 'c' },
  // Row 8 — footer zone
  { top: '90%', left: '102%', w: 'l',  dur: 14, delay: -3,  o: 'hi', c: 'b', t: '2' },
  { top: '93%', left: '110%', w: 's',  dur: 8,  delay: -6,  o: 'lo', c: 'a' },
];

export function AnimatedLineBackground() {
  return (
    <div className="anim-line-bg" aria-hidden="true" role="presentation">
      {lines.map((line, i) => (
        <span
          key={i}
          className="anim-line"
          data-w={line.w}
          data-o={line.o}
          data-c={line.c}
          data-t={line.t}
          style={{
            top: line.top,
            left: line.left,
            animationDuration: `${line.dur}s`,
            animationDelay: `${line.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
