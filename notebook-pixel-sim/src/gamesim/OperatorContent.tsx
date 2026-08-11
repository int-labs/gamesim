/**
 * Operator-authored content rendered inside the player: per-round notes and the
 * end-of-simulation debrief.
 *
 * Both components render `null` unless the operator actually wrote something —
 * no session, no network, an error, an empty list, all collapse to nothing. The
 * approved screens they sit in are therefore pixel-identical until a facilitator
 * publishes content, which is what makes them safe to drop into a signed-off UI.
 *
 * ROLLBACK: delete the one-line usage in the host screen; nothing else refers
 * to this file.
 */
import { useEffect, useState } from 'react';
import { PixelBadge, PixelPanel } from '@/components/primitives';
import { getDebrief, getRoundNotes, type DebriefDto, type RoundNoteDto } from './client';
import { useGamesimSession } from './GamesimProvider';

/** Preserves the operator's paragraph breaks without trusting their markup. */
function Prose({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className="space-y-2">
      {paras.map((p, i) => (
        <p key={i} className="hint leading-[1.6] text-ink-700 whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Notes the facilitator attached to a round — general ones plus any addressed
 * to this team. The server does that filtering; a team token cannot read
 * another team's note whatever it asks for.
 */
export function RoundNotesCard({ roundNumber }: { roundNumber?: number } = {}) {
  const { bootstrap } = useGamesimSession();
  const simulationId = bootstrap?.simulation._id;
  // The FinLit phases (1–3) are a local concept; notes are keyed by the
  // gamesim round the facilitator is actually running.
  const round = roundNumber ?? bootstrap?.round?.roundNumber;
  const [notes, setNotes] = useState<RoundNoteDto[]>([]);

  useEffect(() => {
    if (!simulationId) return undefined;
    let cancelled = false;
    getRoundNotes({ simulationId, ...(round !== undefined ? { roundNumber: round } : {}) })
      .then((n) => !cancelled && setNotes(Array.isArray(n) ? n : []))
      .catch(() => undefined); // no notes route, no notes, offline — all mean "show nothing"
    return () => {
      cancelled = true;
    };
  }, [simulationId, round]);

  if (notes.length === 0) return null;

  return (
    <PixelPanel
      title="FROM YOUR FACILITATOR"
      tone="cream"
      className="mt-3"
      data-testid="round-notes"
    >
      <div className="space-y-3">
        {notes.map((n) => (
          <div key={n._id}>
            <div className="mb-1 flex items-center gap-2">
              <span className="eyebrow eyebrow-sm text-ink-900">
                {n.title}
              </span>
              {n.pinned && <PixelBadge tone="warn">PINNED</PixelBadge>}
              {n.teamId && <PixelBadge tone="info">YOUR TEAM</PixelBadge>}
            </div>
            <Prose text={n.body} />
          </div>
        ))}
      </div>
    </PixelPanel>
  );
}

/**
 * The end-of-simulation debrief. The server keeps this 404 until it is both
 * published AND the simulation is Completed, so this stays invisible for the
 * whole run and appears only once the facilitator closes things out.
 */
export function DebriefCard() {
  const { bootstrap } = useGamesimSession();
  const simulationId = bootstrap?.simulation._id;
  const [debrief, setDebrief] = useState<DebriefDto | null>(null);

  useEffect(() => {
    if (!simulationId) return undefined;
    let cancelled = false;
    getDebrief(simulationId)
      .then((d) => !cancelled && setDebrief(d))
      .catch(() => undefined); // 404 until published + Completed — the normal case
    return () => {
      cancelled = true;
    };
  }, [simulationId]);

  const sections = debrief?.sections ?? [];
  if (!debrief || (!debrief.intro.trim() && sections.length === 0)) return null;

  return (
    <PixelPanel
      title={(debrief.title || 'DEBRIEF').toUpperCase()}
      tone="cream"
      className="mt-4"
      data-testid="debrief"
    >
      <div className="space-y-4">
        <Prose text={debrief.intro} />
        {[...sections]
          .sort((a, b) => a.order - b.order)
          .map((s, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center gap-2">
                <span className="eyebrow eyebrow-sm text-ink-900">
                  {s.title}
                </span>
                {s.teamId && <PixelBadge tone="info">YOUR TEAM</PixelBadge>}
              </div>
              <Prose text={s.body} />
            </div>
          ))}
      </div>
    </PixelPanel>
  );
}
