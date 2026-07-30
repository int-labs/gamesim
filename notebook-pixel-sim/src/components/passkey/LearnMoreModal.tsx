import { createPortal } from 'react-dom';
import { PixelModal, PixelButton } from '@/components/primitives';
import { PASSKEY } from '@/content/copy';

/**
 * "Don't have a pass key?" → a friendly in-app explainer modal.
 * Keeps the user inside the experience instead of bouncing them to an
 * external page. Swap the copy in `PASSKEY.learnMore` (content/copy.ts).
 *
 * Rendered through a portal to <body> so its `position: fixed` layout is
 * relative to the viewport — NOT to the transformed Framer-Motion wrappers
 * (panel slide-in / shake) it lives inside, which would otherwise become
 * the containing block and confine + mis-center the modal.
 */
export function LearnMoreModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <PixelModal
      open={open}
      onClose={onClose}
      title={PASSKEY.learnMore.title}
      width="min(520px, calc(100vw - 32px))"
    >
      <div className="space-y-3 font-body text-[14px] leading-relaxed text-ink-800">
        {PASSKEY.learnMore.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <ul className="list-disc space-y-1 pl-5">
          {PASSKEY.learnMore.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex justify-end">
        <PixelButton variant="primary" onClick={onClose} autoFocus>
          {PASSKEY.learnMore.close}
        </PixelButton>
      </div>
    </PixelModal>,
    document.body,
  );
}
