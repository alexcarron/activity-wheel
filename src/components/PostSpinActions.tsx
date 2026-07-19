/**
 * Buttons shown after the wheel lands. The user can:
 * - Accept (boost weight + exclude from this session)
 * - Reject (drop weight + exclude from this session)
 * - Skip (no weight change, but still exclude. The user has seen this option)
 * - Spin again (uses the remaining session pool)
 * - Reset session (puts every excluded activity back into the pool)
 * "Spin again" only enables when there's still something to spin.
 * Keyboard shortcuts are active for as long as this component is mounted (i.e. while the wheel is in the "landed" phase) and are disabled while a write is in flight (`busy`). Space fires "spin again" when available, matching the idle-phase convention so the user's muscle memory stays the same throughout the session. 
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { useHotkey } from '../hooks/useHotkey';
import { useViewportBreakpoint } from '../hooks/useViewportBreakpoint';
import { HOTKEYS } from '../constants/hotkeys';
import { KbdHint } from './KbdHint';
import './PostSpinActions.css';

type ManualFeedbackAction = Exclude<FeedbackAction, 'undo'>;

interface FeedbackButtonConfig {
	readonly className: string;
	readonly label: string;
	readonly hotkeyLabel: string;
	readonly title: string;
}

const FEEDBACK_BUTTON_CONFIGS: Record<ManualFeedbackAction, FeedbackButtonConfig> = {
	boost: {
		className: 'btn btn-love-it',
		label: '★ Love It!',
		hotkeyLabel: HOTKEYS.LOVE_IT.label,
		title: `Love It! (big weight boost) [${HOTKEYS.LOVE_IT.label}]`,
	},
	accept: {
		className: 'btn btn-accept',
		label: 'Accept',
		hotkeyLabel: HOTKEYS.ACCEPT.label,
		title: `Accept (${HOTKEYS.ACCEPT.label})`,
	},
	skip: {
		className: 'btn btn-skip',
		label: 'Skip',
		hotkeyLabel: HOTKEYS.SKIP.label,
		title: `Skip (${HOTKEYS.SKIP.label})`,
	},
	reject: {
		className: 'btn btn-reject',
		label: 'Reject',
		hotkeyLabel: HOTKEYS.REJECT.label,
		title: `Reject (${HOTKEYS.REJECT.label})`,
	},
	hate: {
		className: 'btn btn-hate-it',
		label: '✕ Hate It!',
		hotkeyLabel: HOTKEYS.HATE_IT.label,
		title: `Hate It! (big weight penalty) [${HOTKEYS.HATE_IT.label}]`,
	},
};

const DESKTOP_FEEDBACK_BUTTON_ORDER: readonly ManualFeedbackAction[][] = [
	['boost',
	'accept',
	'skip',
	'reject',
	'hate'],
];
const PHONE_FEEDBACK_BUTTON_ORDER: readonly ManualFeedbackAction[][] = [
	['boost',
	'accept'],
	['reject',
	'hate'],
	['skip'],
];

interface Props {
	readonly winner: Activity;
	readonly remainingInPool: number;
	/** Triggered by accept/reject/skip. Caller persists feedback + excludes. */
	onChoose(action: FeedbackAction): void;
	onSpinAgain(): void;
	onResetSession(): void;
	/** Disabled while a write is in flight, to avoid double-clicks. */
	readonly busy: boolean;
	/** Optional: allows renaming the winner's activity name inline. */
	onRename?(id: string, name: string): Promise<void>;
	/** All known tag metadata. Needed for the "Add a tag?" combobox. */
	readonly allTagMetadata: readonly TagMetadata[];
	/** Called when the user adds a tag from the post-spin prompt. */
	onAddTag?(activityId: string, tagName: string): Promise<void>;
}

export function PostSpinActions(props: Props) {
	const {
		winner,
		remainingInPool,
		onChoose,
		onSpinAgain,
		onResetSession,
		busy,
		onRename,
		allTagMetadata,
		onAddTag,
	} = props;
	const canSpinAgain = remainingInPool > 0;
	const hasNoTags = (winner.tagIds ?? []).length === 0;
	const { isPhone } = useViewportBreakpoint();
	const feedbackButtonOrder = isPhone ? PHONE_FEEDBACK_BUTTON_ORDER : DESKTOP_FEEDBACK_BUTTON_ORDER;

	/* Quick inline tag input for the "Add a tag?" prompt */
	const [tagPromptOpen, setTagPromptOpen] = useState(false);
	const [tagDraft, setTagDraft] = useState('');
	const tagInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (tagPromptOpen) {
			setTimeout(() => tagInputRef.current?.focus(), 0);
		}
	}, [tagPromptOpen]);

	const commitTag = useCallback(async () => {
		const trimmed = tagDraft.trim();
		if (!trimmed || !onAddTag) return;
		await onAddTag(winner.id, trimmed);
		setTagDraft('');
		setTagPromptOpen(false);
	}, [tagDraft, onAddTag, winner.id]);

	const onTagKey = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') void commitTag();
			if (event.key === 'Escape') {
				setTagPromptOpen(false);
				setTagDraft('');
			}
		},
		[commitTag],
	);

	const tagSuggestions = (() => {
		const queryText = tagDraft.trim().toLowerCase();
		return allTagMetadata
			.filter((tag) => !(winner.tagIds ?? []).includes(tag.id))
			.map((tag) => tag.name)
			.filter((tagName) => !queryText || tagName.toLowerCase().includes(queryText))
			.slice(0, 6);
	})();

	const [editing, setEditing] = useState(false);
	// draft is only populated when entering edit mode; the displayed name when
	// not editing always comes from winner.name directly (the live prop).
	const [draft, setDraft] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const startEditing = useCallback(() => {
		if (!onRename || busy) return;
		setDraft(winner.name);
		setEditing(true);
	}, [onRename, busy, winner.name]);

	const commit = useCallback(async () => {
		const trimmed = draft.trim();
		setEditing(false);
		if (!trimmed || trimmed === winner.name || !onRename) return;
		await onRename(winner.id, trimmed);
	}, [draft, winner.id, winner.name, onRename]);

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

	// Feedback shortcuts. Active whenever this component is visible and not busy.
	useHotkey(HOTKEYS.LOVE_IT.code, () => onChoose('boost'), !busy && !editing);
	useHotkey(HOTKEYS.ACCEPT.code, () => onChoose('accept'), !busy && !editing);
	useHotkey(HOTKEYS.SKIP.code, () => onChoose('skip'), !busy && !editing);
	useHotkey(HOTKEYS.REJECT.code, () => onChoose('reject'), !busy && !editing);
	useHotkey(HOTKEYS.HATE_IT.code, () => onChoose('hate'), !busy && !editing);

	// Space = "spin again" while landed, mirroring the idle-phase Space = spin.
	useHotkey(HOTKEYS.SPIN_WHEEL.code, onSpinAgain, !busy && !editing && canSpinAgain);

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
						maxLength={120}
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
						{winner.name}
					</span>
				)}
			</div>
			{hasNoTags && onAddTag && !tagPromptOpen && (
				<div className="post-spin-tag-nudge">
					<span className="post-spin-tag-nudge-text">No tags yet.</span>
					<button
						type="button"
						className="btn btn-ghost btn-small"
						onClick={() => setTagPromptOpen(true)}
					>
						Add a tag? ＋
					</button>
				</div>
			)}

			{tagPromptOpen && onAddTag && (
				<div className="post-spin-tag-input-row">
					<input
						ref={tagInputRef}
						type="text"
						className="post-spin-tag-input"
						placeholder="Tag name…"
						value={tagDraft}
						onChange={(event) => setTagDraft(event.target.value)}
						onKeyDown={onTagKey}
						maxLength={60}
						list="post-spin-tag-suggestions"
						autoComplete="off"
					/>
					<datalist id="post-spin-tag-suggestions">
						{tagSuggestions.map((name) => (
							<option key={name} value={name} />
						))}
					</datalist>
					<button
						type="button"
						className="btn btn-primary btn-small"
						onClick={() => void commitTag()}
						disabled={!tagDraft.trim()}
					>
						Add
					</button>
					<button
						type="button"
						className="btn btn-ghost btn-small"
						onClick={() => {
							setTagPromptOpen(false);
							setTagDraft('');
						}}
					>
						Cancel
					</button>
				</div>
			)}

			<div className="post-spin-feedback">
				{feedbackButtonOrder.map((actions) => 
					<div className="post-spin-feedback-row"> 
						{actions.map((action) => {
							const config = FEEDBACK_BUTTON_CONFIGS[action];
							return (
								<button
									key={action}
									type="button"
									className={config.className}
									onClick={() => onChoose(action)}
									disabled={busy}
									title={config.title}
								>
									{config.label}
									<KbdHint label={config.hotkeyLabel} />
								</button>
							);
						})}
					</div>
				)}
			</div>
			<div className="post-spin-nav">
				<button
					type="button"
					className="btn btn-secondary"
					onClick={onSpinAgain}
					disabled={busy || !canSpinAgain}
					title={canSpinAgain ? `Spin again (${HOTKEYS.SPIN_WHEEL.label})` : undefined}
				>
					Spin again
					{canSpinAgain && <KbdHint label={HOTKEYS.SPIN_WHEEL.label} />}
				</button>
				<button type="button" className="btn btn-ghost" onClick={onResetSession} disabled={busy}>
					Reset session
				</button>
			</div>
		</div>
	);
}
