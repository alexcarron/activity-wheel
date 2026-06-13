/**
 * Keyboard-shortcut badge rendered inside a button.
 *
 * Styling adapts automatically to the button variant — dark-background buttons
 * (btn-primary, btn-accept, btn-reject) get a white-on-translucent look; all
 * others get a muted dark-on-light look. This is handled entirely in App.css
 * via the `.btn-primary .kbd-hint` etc. selectors, so this component stays
 * purely presentational with zero variant props.
 *
 * Usage:
 *   <button className="btn btn-primary">
 *     Spin the wheel <KbdHint label="Space" />
 *   </button>
 */

interface KbdHintProps {
  readonly label: string;
}

export function KbdHint({ label }: KbdHintProps) {
  return (
    <kbd className="kbd-hint" aria-hidden="true">
      {label}
    </kbd>
  );
}
