import { memo, useEffect, useRef, useState } from 'react';
import type { Activity } from '../../../domain-logic/types';
import { SPIN_TIMING } from '../../../hooks/wheel/useWheel';
import './Wheel.css';

interface WheelProps {
	readonly activities: readonly Activity[];
	/** Estimated stable selection probabilities in the same order as activities. Used to size slices proportionally. */
	readonly sliceProbabilities: readonly number[];
	/** Where the wheel currently sits (resting rotation, in degrees). */
	readonly currentRotationDeg: number;
	/** Where it should end up. Only used while `animating` is true. */
	readonly targetRotationDeg: number;
	/** True between spin click and animation end. */
	readonly animating: boolean;
	readonly onComplete: () => void;
	readonly size?: number;
}

function sliceColor(value: number, minValue: number, maxValue: number): string {
	if (maxValue <= minValue) return '#0AA6B5';
	const linear = (value - minValue) / (maxValue - minValue);
	const curved = Math.pow(linear, 0.55);
	const hue = Math.round(curved * 145);
	const saturation = Math.round(68 + curved * 19);
	const lightness = Math.round(42 - curved * 6);
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function drawWheel({
	canvas,
	activities,
	sliceProbabilities,
	pixelSize,
}: {
	canvas: HTMLCanvasElement;
	activities: readonly Activity[];
	sliceProbabilities: readonly number[];
	pixelSize: number;
}): void {
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

	if (activities.length === 0) {
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

	if (activities.length === 1) {
		canvasContext.beginPath();
		canvasContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
		canvasContext.fillStyle = '#0AA6B5';
		canvasContext.fill();
		canvasContext.fillStyle = '#ffffff';
		canvasContext.font = '20px system-ui, -apple-system, sans-serif';
		canvasContext.textAlign = 'center';
		canvasContext.textBaseline = 'middle';
		canvasContext.fillText(truncate(activities[0].name, 30), centerX, centerY);
		drawHub(canvasContext, centerX, centerY);
		return;
	}

	const totalProbability =
		sliceProbabilities.length === activities.length ? sliceProbabilities.reduce((sum, probability) => sum + probability, 0) : 0;
	const arcs: number[] = activities.map((_, index) =>
		totalProbability > 0 ? (sliceProbabilities[index] / totalProbability) * Math.PI * 2 : (Math.PI * 2) / activities.length,
	);

	const minProbability = sliceProbabilities.length > 0 ? Math.min(...sliceProbabilities) : 0;
	const maxProbability = sliceProbabilities.length > 0 ? Math.max(...sliceProbabilities) : 0;

	let angle = -Math.PI / 2;
	for (let i = 0; i < activities.length; i++) {
		const start = angle;
		const end = angle + arcs[i];
		canvasContext.beginPath();
		canvasContext.moveTo(centerX, centerY);
		canvasContext.arc(centerX, centerY, radius, start, end);
		canvasContext.closePath();
		canvasContext.fillStyle = sliceColor(sliceProbabilities[i] ?? 1, minProbability, maxProbability);
		canvasContext.fill();
		canvasContext.strokeStyle = 'rgba(45,52,54,0.15)';
		canvasContext.lineWidth = 1;
		canvasContext.stroke();
		angle = end;
	}

	// Second pass. Labels on top of fills.
	const baseFontSize = Math.max(10, Math.min(15, Math.floor(280 / activities.length) + 6));
	const baseMaxChars = Math.max(6, Math.floor(20 - activities.length / 12));
	const equalArcDeg = 360 / activities.length;
	canvasContext.textBaseline = 'middle';

	angle = -Math.PI / 2;
	for (let i = 0; i < activities.length; i++) {
		const arcAngle = arcs[i];
		const arcDeg = (arcAngle / (Math.PI * 2)) * 360;
		const center = angle + arcAngle / 2;

		if (arcDeg >= 5) {
			// Scale chars and font proportionally to how large this slice is relative to an equal slice.
			const relativeSize = arcDeg / equalArcDeg;
			const maxChars = Math.max(3, Math.round(baseMaxChars * Math.min(relativeSize, 2)));
			const fontSize = Math.max(9, Math.min(baseFontSize, Math.round(arcDeg / 6)));

			canvasContext.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
			canvasContext.save();
			canvasContext.translate(centerX, centerY);
			canvasContext.rotate(center);
			canvasContext.textAlign = 'right';
			canvasContext.fillStyle = '#ffffff';
			canvasContext.fillText(truncate(activities[i].name, maxChars), radius - 12, 0);
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
	const { activities, sliceProbabilities, currentRotationDeg, targetRotationDeg, animating, onComplete } = props;
	const wheelSizeWrapRef = useRef<HTMLDivElement>(null);
	const [measuredSize, setMeasuredSize] = useState(420);
	const size = props.size ?? measuredSize;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rotorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const wheelSizeWrap = wheelSizeWrapRef.current;
		if (!wheelSizeWrap) return;

		const measure = (): void => {
			const width = wheelSizeWrap.getBoundingClientRect().width;
			if (width > 0) setMeasuredSize(Math.round(width));
		};
		measure();

		let debounceTimeoutID = 0;
		const handleResize = (): void => {
			window.clearTimeout(debounceTimeoutID);
			debounceTimeoutID = window.setTimeout(measure, 150);
		};
		window.addEventListener('resize', handleResize);
		return () => {
			window.clearTimeout(debounceTimeoutID);
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	useEffect(() => {
		if (canvasRef.current) drawWheel({ canvas: canvasRef.current, activities, sliceProbabilities, pixelSize: size });
	}, [activities, sliceProbabilities, size]);

	useEffect(() => {
		const rotor = rotorRef.current;
		if (!rotor) return;

		if (!animating) {
			rotor.style.transform = `rotate(${currentRotationDeg}deg)`;
			return;
		}

		let animationFrameID = 0;
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
				animationFrameID = requestAnimationFrame(frame);
			}
			else {
				rotor.style.transform = `rotate(${to}deg)`;
				onComplete();
			}
		};
		animationFrameID = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(animationFrameID);
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
