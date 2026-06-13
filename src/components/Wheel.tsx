/**
 * Canvas-based wheel.
 *
 * Why canvas, not SVG:
 *  - Drawing 200 SVG `<path>` slices + labels chews through layout per frame
 *    and forces React/the DOM to do work that's irrelevant to a simple
 *    rotation.
 *  - With a single canvas we draw once and just CSS-transform the element.
 *
 * What this component does NOT do:
 *  - Pick a winner. It is *given* the target rotation (via `targetRotationDeg`
 *    when `animating` flips on) and animates to it.
 *
 * Animation runs in requestAnimationFrame and writes `transform` directly to
 * the DOM so React doesn't re-render every frame.
 */

import { memo, useEffect, useRef } from 'react';
import type { Activity } from '../domain-logic/types';
import { SPIN_TIMING } from '../hooks/wheel/useWheel';

interface WheelProps {
  readonly pool: readonly Activity[];
  /** Effective weights in the same order as pool. Used to size slices proportionally. */
  readonly weights: readonly number[];
  /** Where the wheel currently sits (resting rotation, in degrees). */
  readonly currentRotationDeg: number;
  /** Where it should end up. Only used while `animating` is true. */
  readonly targetRotationDeg: number;
  /** True between spin click and animation end. */
  readonly animating: boolean;
  /** Called when the rAF loop reaches t = 1. */
  readonly onComplete: () => void;
  readonly size?: number;
}

// Mirrors the brand palette in index.css; canvas can't consume CSS custom
// properties, so these are kept in sync by hand.
const PALETTE = [
  '#ff6b6b', '#4ecdc4', '#f08c00', '#37b24d', '#748ffc',
  '#cc5de8', '#20c997', '#f06595', '#f4b400', '#5c7cfa',
];

function colorFor(i: number): string {
  return PALETTE[i % PALETTE.length];
}

function drawWheel(canvas: HTMLCanvasElement, pool: readonly Activity[], weights: readonly number[], pixelSize: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(pixelSize * dpr);
  canvas.height = Math.round(pixelSize * dpr);
  canvas.style.width = `${pixelSize}px`;
  canvas.style.height = `${pixelSize}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, pixelSize, pixelSize);

  const cx = pixelSize / 2;
  const cy = pixelSize / 2;
  const radius = pixelSize / 2 - 6;

  if (pool.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3436';
    ctx.fill();
    ctx.fillStyle = '#a0a8ab';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add an activity to get started', cx, cy);
    return;
  }

  if (pool.length === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncate(pool[0].name, 30), cx, cy);
    drawHub(ctx, cx, cy);
    return;
  }

  // Compute arc for each slice. Fall back to equal slices if weights are
  // missing, mismatched, or sum to zero.
  const totalWeight = weights.length === pool.length
    ? weights.reduce((a, b) => a + b, 0)
    : 0;
  const arcs: number[] = pool.map((_, i) =>
    totalWeight > 0
      ? (weights[i] / totalWeight) * Math.PI * 2
      : (Math.PI * 2) / pool.length,
  );

  // Slice 0's LEFT EDGE starts at -π/2 (12 o'clock, top of wheel).
  // This keeps the spin-formula's "sliceCenterFromTop" consistent:
  //   sliceCenterFromTop[i] = (cumulative_weight_before_i + weight_i/2) / total * 360
  // which reduces to (i+0.5)*(360/n) for equal weights — matching useWheel.ts.

  // First pass — fill slices.
  let angle = -Math.PI / 2;
  for (let i = 0; i < pool.length; i++) {
    const start = angle;
    const end = angle + arcs[i];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colorFor(i);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,52,54,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    angle = end;
  }

  // Second pass — labels on top of fills.
  const baseFontSize = Math.max(10, Math.min(15, Math.floor(280 / pool.length) + 6));
  const baseMaxChars = Math.max(6, Math.floor(20 - pool.length / 12));
  const equalArcDeg = 360 / pool.length;
  ctx.textBaseline = 'middle';

  angle = -Math.PI / 2;
  for (let i = 0; i < pool.length; i++) {
    const arcAngle = arcs[i];
    const arcDeg = (arcAngle / (Math.PI * 2)) * 360;
    const center = angle + arcAngle / 2;

    if (arcDeg >= 5) {
      // Scale chars and font proportionally to how large this slice is
      // relative to an equal slice.
      const relSize = arcDeg / equalArcDeg;
      const maxChars = Math.max(3, Math.round(baseMaxChars * Math.min(relSize, 2)));
      const fontSize = Math.max(9, Math.min(baseFontSize, Math.round(arcDeg / 6)));

      ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(center);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(truncate(pool[i].name, maxChars), radius - 12, 0);
      ctx.restore();
    }

    angle += arcAngle;
  }

  drawHub(ctx, cx, cy);
}

function drawHub(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,52,54,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, maxChars - 1)) + '…';
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function WheelComponent(props: WheelProps) {
  const { pool, weights, currentRotationDeg, targetRotationDeg, animating, onComplete } = props;
  const size = props.size ?? 420;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);

  // Redraw whenever the pool or weights change.
  useEffect(() => {
    if (canvasRef.current) drawWheel(canvasRef.current, pool, weights, size);
  }, [pool, weights, size]);

  // Animate when `animating` is true.
  useEffect(() => {
    const rotor = rotorRef.current;
    if (!rotor) return;

    if (!animating) {
      rotor.style.transform = `rotate(${currentRotationDeg}deg)`;
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = SPIN_TIMING.durationMs;
    const from = currentRotationDeg;
    const to = targetRotationDeg;

    const frame = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      const rot = from + (to - from) * eased;
      rotor.style.transform = `rotate(${rot}deg)`;
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        rotor.style.transform = `rotate(${to}deg)`;
        onComplete();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // We deliberately depend only on the `animating` flip — `currentRotation`
    // and `targetRotation` are captured at the moment the spin begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating]);

  return (
    <div className="wheel" style={{ width: size, height: size, pointerEvents: 'none' }}>
      <div ref={rotorRef} className="wheel-rotor" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} className="wheel-canvas" />
      </div>
      <div className="wheel-pointer" aria-hidden="true" />
    </div>
  );
}

export const Wheel = memo(WheelComponent);
