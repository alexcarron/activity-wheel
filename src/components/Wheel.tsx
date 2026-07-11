/**
 * Canvas-based wheel. Why canvas, not SVG: drawing 200 SVG `<path>` slices + labels chews through layout per frame and forces React/the DOM to do work that's irrelevant to a simple rotation, and with a single canvas we draw once and just CSS-transform the element.
 * What this component does NOT do: pick a winner. It is *given* the target rotation (via `targetRotationDeg` when `animating` flips on) and animates to it.
 * Animation runs in requestAnimationFrame and writes `transform` directly to the DOM so React doesn't re-render every frame. 
 */

import { memo, useEffect, useRef, useState } from 'react';
import type { Activity } from '../domain-logic/types';
import { SPIN_TIMING } from '../hooks/wheel/useWheel';
import './Wheel.css';

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

// Interpolates from red (low weight) to green (high weight) in HSL space.
// Matches the warn/good semantic colors used elsewhere in the UI:
//   low  → hsl(0,  68%, 42%)  ≈ --warn   (#C83A3A)
//   high → hsl(145, 87%, 36%) ≈ --boost  (#06b354)
// When all weights are equal, falls back to a neutral teal.
function sliceColor(weight: number, minWeight: number, maxWeight: number): string {
	if (maxWeight <= minWeight) return '#0AA6B5';
	const linear = (weight - minWeight) / (maxWeight - minWeight);
	// Power curve < 1 expands the low end so small weight differences among
	// low-weight activities produce visually distinct hues, while high-weight
	// activities compress toward green.
	const curved = Math.pow(linear, 0.55);
	const hue = Math.round(curved * 145);
	const saturation = Math.round(68 + curved * 19);
	const lightness = Math.round(42 - curved * 6);
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function drawWheel(
	canvas: HTMLCanvasElement,
	pool: readonly Activity[],
	weights: readonly number[],
	pixelSize: number,
): void {
	const canvasContext = canvas.getContext('2d');
	if (!canvasContext) return;
	const devicePixelRatio = window.devicePixelRatio || 1;
	canvas.width = Math.round(pixelSize * devicePixelRatio);
	canvas.height = Math.round(pixelSize * devicePixelRatio);
	canvas.style.width = `${pixelSize}px`;
	canvas.style.height = `${pixelSize}px`;
	canvasContext.setTransform(1, 0, 0, 1, 0, 0);
	canvasContext.scale(devicePixelRatio, devicePixelRatio);
	canvasContext.clearRect(0, 0, pixelSize, pixelSize);

	const centerX = pixelSize / 2;
	const centerY = pixelSize / 2;
	const radius = pixelSize / 2 - 6;

	if (pool.length === 0) {
		canvasContext.beginPath();
		canvasContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
		canvasContext.fillStyle = '#2d3436';
		canvasContext.fill();
		canvasContext.fillStyle = '#a0a8ab';
		canvasContext.font = '16px system-ui, -apple-system, sans-serif';
		canvasContext.textAlign = 'center';
		canvasContext.textBaseline = 'middle';
		canvasContext.fillText('Add an activity to get started', centerX, centerY);
		return;
	}

	if (pool.length === 1) {
		canvasContext.beginPath();
		canvasContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
		canvasContext.fillStyle = '#0AA6B5';
		canvasContext.fill();
		canvasContext.fillStyle = '#ffffff';
		canvasContext.font = '20px system-ui, -apple-system, sans-serif';
		canvasContext.textAlign = 'center';
		canvasContext.textBaseline = 'middle';
		canvasContext.fillText(truncate(pool[0].name, 30), centerX, centerY);
		drawHub(canvasContext, centerX, centerY);
		return;
	}

	// Compute arc for each slice. Fall back to equal slices if weights are
	// missing, mismatched, or sum to zero.
	const totalWeight =
		weights.length === pool.length ? weights.reduce((sum, weight) => sum + weight, 0) : 0;
	const arcs: number[] = pool.map((_, index) =>
		totalWeight > 0 ? (weights[index] / totalWeight) * Math.PI * 2 : (Math.PI * 2) / pool.length,
	);

	const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
	const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;

	// Slice 0's LEFT EDGE starts at -π/2 (12 o'clock, top of wheel).
	// This keeps the spin-formula's "sliceCenterFromTop" consistent:
	//   sliceCenterFromTop[i] = (cumulative_weight_before_i + weight_i/2) / total * 360
	// which reduces to (i+0.5)*(360/n) for equal weights. Matching useWheel.ts.

	// First pass. Fill slices.
	let angle = -Math.PI / 2;
	for (let i = 0; i < pool.length; i++) {
		const start = angle;
		const end = angle + arcs[i];
		canvasContext.beginPath();
		canvasContext.moveTo(centerX, centerY);
		canvasContext.arc(centerX, centerY, radius, start, end);
		canvasContext.closePath();
		canvasContext.fillStyle = sliceColor(weights[i] ?? 1, minWeight, maxWeight);
		canvasContext.fill();
		canvasContext.strokeStyle = 'rgba(45,52,54,0.15)';
		canvasContext.lineWidth = 1;
		canvasContext.stroke();
		angle = end;
	}

	// Second pass. Labels on top of fills.
	const baseFontSize = Math.max(10, Math.min(15, Math.floor(280 / pool.length) + 6));
	const baseMaxChars = Math.max(6, Math.floor(20 - pool.length / 12));
	const equalArcDeg = 360 / pool.length;
	canvasContext.textBaseline = 'middle';

	angle = -Math.PI / 2;
	for (let i = 0; i < pool.length; i++) {
		const arcAngle = arcs[i];
		const arcDeg = (arcAngle / (Math.PI * 2)) * 360;
		const center = angle + arcAngle / 2;

		if (arcDeg >= 5) {
			// Scale chars and font proportionally to how large this slice is
			// relative to an equal slice.
			const relativeSize = arcDeg / equalArcDeg;
			const maxChars = Math.max(3, Math.round(baseMaxChars * Math.min(relativeSize, 2)));
			const fontSize = Math.max(9, Math.min(baseFontSize, Math.round(arcDeg / 6)));

			canvasContext.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
			canvasContext.save();
			canvasContext.translate(centerX, centerY);
			canvasContext.rotate(center);
			canvasContext.textAlign = 'right';
			canvasContext.fillStyle = '#ffffff';
			canvasContext.fillText(truncate(pool[i].name, maxChars), radius - 12, 0);
			canvasContext.restore();
		}

		angle += arcAngle;
	}

	drawHub(canvasContext, centerX, centerY);
}

function drawHub(canvasContext: CanvasRenderingContext2D, centerX: number, centerY: number): void {
	canvasContext.beginPath();
	canvasContext.arc(centerX, centerY, 28, 0, Math.PI * 2);
	canvasContext.fillStyle = '#ffffff';
	canvasContext.fill();
	canvasContext.strokeStyle = 'rgba(45,52,54,0.2)';
	canvasContext.lineWidth = 2;
	canvasContext.stroke();
}

function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return text.slice(0, Math.max(1, maxChars - 1)) + '…';
}

const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - progress, 3);

function WheelComponent(props: WheelProps) {
	const { pool, weights, currentRotationDeg, targetRotationDeg, animating, onComplete } = props;
	const wheelSizeWrapRef = useRef<HTMLDivElement>(null);
	const [measuredSize, setMeasuredSize] = useState(420);
	const size = props.size ?? measuredSize;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rotorRef = useRef<HTMLDivElement>(null);

	// Measures the CSS-driven `.wheel-size-wrap` box so the canvas's imperative pixel buffer (set in drawWheel) can track it. min()/aspect-ratio in CSS picks the target size responsively; this just reads it back into JS.
	useEffect(() => {
		const wheelSizeWrap = wheelSizeWrapRef.current;
		if (!wheelSizeWrap) return;

		const measure = (): void => {
			const width = wheelSizeWrap.getBoundingClientRect().width;
			if (width > 0) setMeasuredSize(Math.round(width));
		};
		measure();

		let debounceTimeoutId = 0;
		const handleResize = (): void => {
			window.clearTimeout(debounceTimeoutId);
			debounceTimeoutId = window.setTimeout(measure, 150);
		};
		window.addEventListener('resize', handleResize);
		return () => {
			window.clearTimeout(debounceTimeoutId);
			window.removeEventListener('resize', handleResize);
		};
	}, []);

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

		let animationFrameId = 0;
		const start = performance.now();
		const duration = SPIN_TIMING.durationMs;
		const from = currentRotationDeg;
		const to = targetRotationDeg;

		const frame = (now: number): void => {
			const progress = Math.min(1, (now - start) / duration);
			const eased = easeOutCubic(progress);
			const rotationDeg = from + (to - from) * eased;
			rotor.style.transform = `rotate(${rotationDeg}deg)`;
			if (progress < 1) {
				animationFrameId = requestAnimationFrame(frame);
			}
			else {
				rotor.style.transform = `rotate(${to}deg)`;
				onComplete();
			}
		};
		animationFrameId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(animationFrameId);
		// We deliberately depend only on the `animating` flip. `currentRotation`
		// and `targetRotation` are captured at the moment the spin begins.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [animating]);

	return (
		<div ref={wheelSizeWrapRef} className="wheel-size-wrap">
			<div className="wheel" style={{ width: size, height: size, pointerEvents: 'none' }}>
				<div ref={rotorRef} className="wheel-rotor" style={{ width: size, height: size }}>
					<canvas ref={canvasRef} className="wheel-canvas" />
				</div>
				<div className="wheel-pointer" aria-hidden="true" />
			</div>
		</div>
	);
}

export const Wheel = memo(WheelComponent);
