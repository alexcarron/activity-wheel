/**
 * Buttons shown after the wheel lands. The user can:
 *   - Accept (boost weight + exclude from this session)
 *   - Reject (drop weight + exclude from this session)
 *   - Skip (no weight change, but still exclude — the user has seen this option)
 *   - Spin again (uses the remaining session pool)
 *   - Reset session (puts every excluded activity back into the pool)
 *
 * "Spin again" only enables when there's still something to spin.
 *
 * Keyboard shortcuts are active for as long as this component is mounted
 * (i.e. while the wheel is in the "landed" phase) and are disabled while a
 * write is in flight (`busy`). Space fires "spin again" when available,
 * matching the idle-phase convention so the user's muscle memory stays the
 * same throughout the session.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { useHotkey } from '../hooks/useHotkey';
import { HOTKEYS } from '../hotkeys';
import { KbdHint } from './KbdHint';

interface Props {
  readonly winner: Activity;
  readonly remainingInPool: number;
  /** Triggered by accept/reject/skip — caller persists feedback + excludes. */
  onChoose(action: FeedbackAction): void;
  onSpinAgain(): void;
  onResetSession(): void;
  /** Disabled while a write is in flight, to avoid double-clicks. */
  readonly busy: boolean;
  /** Optional: allows renaming the winner's activity name inline. */
  onRename?(id: string, name: string): Promise<void>;
  /** All known tag metadata — needed for the "Add a tag?" combobox. */
  readonly allTagMetadata: readonly TagMetadata[];
  /** Called when the user adds a tag from the post-spin prompt. */
  onAddTag?(activityId: string, tagName: string): Promise<void>;
}

export function PostSpinActions(props: Props) {
  const { winner, remainingInPool, onChoose, onSpinAgain, onResetSession, busy, onRename, allTagMetadata, onAddTag } = props;
  const canSpinAgain = remainingInPool > 0;
  const hasNoTags = (winner.tags ?? []).length === 0;

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
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') void commitTag();
      if (e.key === 'Escape') { setTagPromptOpen(false); setTagDraft(''); }
    },
    [commitTag],
  );

  const tagSuggestions = (() => {
    const q = tagDraft.trim().toLowerCase();
    return allTagMetadata
      .map((t) => t.name)
      .filter((n) => !(winner.tags ?? []).includes(n))
      .filter((n) => !q || n.toLowerCase().includes(q))
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
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') void commit();
      if (e.key === 'Escape') setEditing(false);
    },
    [commit],
  );

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Feedback shortcuts — active whenever this component is visible and not busy.
  useHotkey(HOTKEYS.SUPER_FUN.code, () => onChoose('boost'),  !busy && !editing);
  useHotkey(HOTKEYS.ACCEPT.code,    () => onChoose('accept'), !busy && !editing);
  useHotkey(HOTKEYS.SKIP.code,      () => onChoose('skip'),   !busy && !editing);
  useHotkey(HOTKEYS.REJECT.code,    () => onChoose('reject'), !busy && !editing);
  useHotkey(HOTKEYS.HATE_IT.code,   () => onChoose('hate'),   !busy && !editing);

  // Space = "spin again" while landed, mirroring the idle-phase Space = spin.
  useHotkey(HOTKEYS.SPIN.code, onSpinAgain, !busy && !editing && canSpinAgain);

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
            onChange={(e) => setDraft(e.target.value)}
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
            onKeyDown={onRename ? (e) => { if (e.key === 'Enter' || e.key === ' ') startEditing(); } : undefined}
          >
            {winner.name}
          </span>
        )}
      </div>
      {/* "Add a tag?" nudge — only for untagged activities */}
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

      {/* Inline tag input (shown when nudge is clicked) */}
      {tagPromptOpen && onAddTag && (
        <div className="post-spin-tag-input-row">
          <input
            ref={tagInputRef}
            type="text"
            className="post-spin-tag-input"
            placeholder="Tag name…"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
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
            onClick={() => { setTagPromptOpen(false); setTagDraft(''); }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="post-spin-feedback">
        <button
          type="button"
          className="btn btn-super-fun"
          onClick={() => onChoose('boost')}
          disabled={busy}
          title={`Super Fun! — big weight boost (${HOTKEYS.SUPER_FUN.label})`}
        >
          ★ Super Fun!
          <KbdHint label={HOTKEYS.SUPER_FUN.label} />
        </button>
        <button
          type="button"
          className="btn btn-accept"
          onClick={() => onChoose('accept')}
          disabled={busy}
          title={`Accept (${HOTKEYS.ACCEPT.label})`}
        >
          Accept
          <KbdHint label={HOTKEYS.ACCEPT.label} />
        </button>
        <button
          type="button"
          className="btn btn-skip"
          onClick={() => onChoose('skip')}
          disabled={busy}
          title={`Skip (${HOTKEYS.SKIP.label})`}
        >
          Skip
          <KbdHint label={HOTKEYS.SKIP.label} />
        </button>
        <button
          type="button"
          className="btn btn-reject"
          onClick={() => onChoose('reject')}
          disabled={busy}
          title={`Reject (${HOTKEYS.REJECT.label})`}
        >
          Reject
          <KbdHint label={HOTKEYS.REJECT.label} />
        </button>
        <button
          type="button"
          className="btn btn-hate-it"
          onClick={() => onChoose('hate')}
          disabled={busy}
          title={`Hate It! — big weight penalty (${HOTKEYS.HATE_IT.label})`}
        >
          ✕ Hate It!
          <KbdHint label={HOTKEYS.HATE_IT.label} />
        </button>
      </div>
      <div className="post-spin-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onSpinAgain}
          disabled={busy || !canSpinAgain}
          title={canSpinAgain ? `Spin again (${HOTKEYS.SPIN.label})` : undefined}
        >
          Spin again ({remainingInPool} left)
          {canSpinAgain && <KbdHint label={HOTKEYS.SPIN.label} />}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onResetSession}
          disabled={busy}
        >
          Reset session
        </button>
      </div>
    </div>
  );
}
