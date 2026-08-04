import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Persisted store key (see state/store.ts). Clearing it recovers from a
 *  corrupt-state crash loop without the player having to clear site data. */
const PERSIST_KEY = 'intlabs:sim:state:v1';

/**
 * App-level safety net. A render throw anywhere below this boundary would
 * otherwise blank the entire React root to a white screen with no recovery —
 * unacceptable for an unguided demo. Instead we catch it and show a calm,
 * on-brand "something went wrong" panel with Reload + Reset actions.
 *
 * Deliberately styled with INLINE styles (not Tailwind classes) so the fallback
 * renders correctly even if a stylesheet or design token is what failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface in the console for diagnosis; never rethrow.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught a render error:', error, info);
  }

  private reload = () => window.location.reload();

  private reset = () => {
    try {
      localStorage.removeItem(PERSIST_KEY);
    } catch {
      /* ignore storage errors */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const btnBase: React.CSSProperties = {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 11,
      letterSpacing: '0.04em',
      padding: '12px 18px',
      border: '2px solid #2A1E12',
      cursor: 'pointer',
      textTransform: 'uppercase',
    };

    return (
      <div
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#2A1C10',
          color: '#2A1E12',
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: '100%',
            background: '#FBF6E9',
            border: '3px solid #2A1E12',
            boxShadow: '6px 6px 0 0 rgba(42,30,18,0.65)',
            padding: 28,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 15,
              lineHeight: 1.5,
              marginBottom: 14,
              color: '#2A1E12',
            }}
          >
            Something went wrong
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 22px', color: '#5A4630' }}>
            The simulation hit an unexpected snag. Your progress is saved, so
            reloading usually picks things right back up.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.reload}
              style={{ ...btnBase, background: '#6FBB85', color: '#0F2A19' }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.reset}
              style={{ ...btnBase, background: '#FBF6E9', color: '#2A1E12' }}
            >
              Reset &amp; start over
            </button>
          </div>
        </div>
      </div>
    );
  }
}
