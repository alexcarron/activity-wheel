import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { MAXIMUM_ACTIVITY_NAME_LENGTH, type Activity, type RatingFeedbackAction } from '../../../domain-logic/types';
import { useHotkey } from '../../../hooks/useHotkey';
import { HOTKEYS } from '../../../constants/hotkeys';
import {
	FEEDBACK_ACTION_TO_BUTTON_LABEL,
	FEEDBACK_ACTION_TO_BUTTON_TOOLTIP,
	RATING_FEEDBACK_ACTIONS_BEST_TO_WORST,
} from '../../../constants/feedback-buttons';
import { KeyboardHint } from '../../reusable/KeyboardHint';
import { HeartIcon } from '../../svg-icons/HeartIcon';
import { BrokenHeartIcon } from '../../svg-icons/BrokenHeartIcon';
import { ThumbsUpIcon } from '../../svg-icons/ThumbsUpIcon';
import { NeutralFaceIcon } from '../../svg-icons/NeutralFaceIcon';
import { ThumbsDownIcon } from '../../svg-icons/ThumbsDownIcon';
import './PostSpinActions.css';

interface FeedbackButtonConfig {
	readonly className: string;
	readonly icon: ReactNode;
	readonly label: string;
	readonly hotkeyLabel: string;
	readonly title: string;
}

const FEEDBACK_BUTTON_CONFIGS: Record<RatingFeedbackAction, FeedbackButtonConfig> = {
	love: {
		className: 'btn btn-love-it',
		icon: <HeartIcon />,
		label: FEEDBACK_ACTION_TO_BUTTON_LABEL.love,
		hotkeyLabel: HOTKEYS.LOVE_IT.label,
		title: `${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP.love} [${HOTKEYS.LOVE_IT.label}]`,
	},
	like: {
		className: 'btn btn-like-it',
		icon: <ThumbsUpIcon />,
		label: FEEDBACK_ACTION_TO_BUTTON_LABEL.like,
		hotkeyLabel: HOTKEYS.LIKE_IT.label,
		title: `${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP.like} [${HOTKEYS.LIKE_IT.label}]`,
	},
	neutral: {
		className: 'btn btn-neutral',
		icon: <NeutralFaceIcon />,
		label: FEEDBACK_ACTION_TO_BUTTON_LABEL.neutral,
		hotkeyLabel: HOTKEYS.NEUTRAL.label,
		title: `${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP.neutral} [${HOTKEYS.NEUTRAL.label}]`,
	},
	dislike: {
		className: 'btn btn-dislike-it',
		icon: <ThumbsDownIcon />,
		label: FEEDBACK_ACTION_TO_BUTTON_LABEL.dislike,
		hotkeyLabel: HOTKEYS.DISLIKE_IT.label,
		title: `${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP.dislike} [${HOTKEYS.DISLIKE_IT.label}]`,
	},
	hate: {
		className: 'btn btn-hate-it',
		icon: <BrokenHeartIcon />,
		label: FEEDBACK_ACTION_TO_BUTTON_LABEL.hate,
		hotkeyLabel: HOTKEYS.HATE_IT.label,
		title: `${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP.hate} [${HOTKEYS.HATE_IT.label}]`,
	},
};

interface Props {
	readonly landedOnActivity: Activity;
	readonly remainingActivityCount: number;
	onRate(action: RatingFeedbackAction): void;
	onRateLater(): void;
	onSpinAgain(): void;
	onResetSession(): void;
	/** Disabled while a write is in flight, to avoid double-clicks. */
	readonly busy: boolean;
	/** Optional: allows renaming the landed-on activity inline. */
	onRename?(id: string, name: string): Promise<void>;
}

export function PostSpinActions(props: Props) {
	const {
		landedOnActivity,
		remainingActivityCount,
		onRate,
		onRateLater,
		onSpinAgain,
		onResetSession,
		busy,
		onRename,
	} = props;
	const canSpinAgain = remainingActivityCount > 0;
	const [hasGoneWithThis, setHasGoneWithThis] = useState(false);

	const [editing, setEditing] = useState(false);
	// draft is only populated when entering edit mode. The displayed name when not editing always comes from landedOnActivity.name directly (the live prop).
	const [draft, setDraft] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const startEditing = useCallback(() => {
		if (!onRename || busy) return;
		setDraft(landedOnActivity.name);
		setEditing(true);
	}, [onRename, busy, landedOnActivity.name]);

	const commit = useCallback(async () => {
		const trimmed = draft.trim();
		setEditing(false);
		if (!trimmed || trimmed === landedOnActivity.name || !onRename) return;
		await onRename(landedOnActivity.id, trimmed);
	}, [draft, landedOnActivity.id, landedOnActivity.name, onRename]);

	const onKey = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') void commit();
			if (event.key === 'Escape') setEditing(false);
		},
		[commit],
	);

	useEffect(() => {
		if (editing) inputRef.current?.select();
	}, [editing]);

	const canUseHotkeys = !busy && !editing;
	const canUseRatingHotkeys = canUseHotkeys && hasGoneWithThis;
	const goWithThis = useCallback(() => setHasGoneWithThis(true), []);
	useHotkey(HOTKEYS.LOVE_IT.code, () => onRate('love'), canUseRatingHotkeys);
	useHotkey(HOTKEYS.LIKE_IT.code, () => onRate('like'), canUseRatingHotkeys);
	useHotkey(HOTKEYS.NEUTRAL.code, () => onRate('neutral'), canUseRatingHotkeys);
	useHotkey(HOTKEYS.DISLIKE_IT.code, () => onRate('dislike'), canUseRatingHotkeys);
	useHotkey(HOTKEYS.HATE_IT.code, () => onRate('hate'), canUseRatingHotkeys);

	useHotkey(HOTKEYS.GO_WITH_THIS.code, goWithThis, canUseHotkeys && !hasGoneWithThis);
	useHotkey(HOTKEYS.SPIN_WHEEL.code, onSpinAgain, canUseHotkeys && canSpinAgain && !hasGoneWithThis);

	const renderFeedbackButton = (action: RatingFeedbackAction): ReactNode => {
		const config = FEEDBACK_BUTTON_CONFIGS[action];
		return (
			<button
				key={action}
				type="button"
				className={config.className}
				style={{ gridArea: action }}
				onClick={() => onRate(action)}
				disabled={busy}
				title={config.title}
			>
				{config.icon}
				{config.label}
				<KeyboardHint label={config.hotkeyLabel} />
			</button>
		);
	};

	return (
		<div className="post-spin">
			<div className="post-spin-result">
				<span className="post-spin-label">Landed on</span>
				{editing ? (
					/* name edit input */
					<input
						ref={inputRef}
						type="text"
						className="post-spin-name-edit"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={onKey}
						onBlur={() => void commit()}
						maxLength={MAXIMUM_ACTIVITY_NAME_LENGTH}
					/>
				) : (
					<span
						className={`post-spin-name${onRename ? ' post-spin-name-editable' : ''}`}
						onClick={startEditing}
						title={onRename ? 'Click to rename' : undefined}
						role={onRename ? 'button' : undefined}
						tabIndex={onRename ? 0 : undefined}
						onKeyDown={
							onRename
								? (event) => {
										if (event.key === 'Enter' || event.key === ' ') startEditing();
									}
								: undefined
						}
					>
						{landedOnActivity.name}
					</span>
				)}
			</div>
			{hasGoneWithThis ? (
				<>
					<div className="post-spin-feedback-header">
						<span className="post-spin-feedback-question">How was the activity?</span>
						<button
							type="button"
							className="btn btn-ghost btn-small"
							onClick={onRateLater}
							disabled={busy}
							title="Rate it later from the How was it? list"
						>
							Rate it later
						</button>
					</div>
					<div className="post-spin-feedback">
						{RATING_FEEDBACK_ACTIONS_BEST_TO_WORST.map(renderFeedbackButton)}
					</div>
				</>
			) : (
				<div className="post-spin-decision">
					<button
						type="button"
						className="btn btn-primary btn-large"
						onClick={goWithThis}
						disabled={busy}
						title={`Do this one, then rate it (${HOTKEYS.GO_WITH_THIS.label})`}
					>
						Go with this
						<KeyboardHint label={HOTKEYS.GO_WITH_THIS.label} />
					</button>
					<button
						type="button"
						className="btn btn-secondary btn-large"
						onClick={onSpinAgain}
						disabled={busy || !canSpinAgain}
						title={canSpinAgain ? `Not this one, get another (${HOTKEYS.SPIN_WHEEL.label})` : undefined}
					>
						Spin again
						{canSpinAgain && <KeyboardHint label={HOTKEYS.SPIN_WHEEL.label} />}
					</button>
				</div>
			)}

			<div className="post-spin-nav">
				<button type="button" className="btn btn-ghost" onClick={onResetSession} disabled={busy}>
					Reset wheel
				</button>
			</div>
		</div>
	);
}
