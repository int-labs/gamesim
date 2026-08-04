import { useEffect, lazy, Suspense } from 'react';
import { useGame } from '@/state/store';
import {
  expandScript,
  SCRIPT_INTRO,
  SCRIPT_AFTER_PHASE1,
  SCRIPT_PHASE2_START,
  SCRIPT_PHASE3_START,
  SCRIPT_FINAL,
} from '@/content/mascotScripts';
import { evaluateFeedback } from '@/content/dynamicFeedback';
import { StartScreen } from '@/screens/StartScreen';
import { RouteChoiceScreen } from '@/screens/RouteChoiceScreen';
import { PhaseIntroScreen } from '@/screens/PhaseIntroScreen';
import { SimulationScreen } from '@/screens/SimulationScreen';
import { VisualNovelMascot } from '@/components/mascot/VisualNovelMascot';
import { AudiencePickerModal } from '@/components/AudiencePickerModal';
import { Toast } from '@/components/Toast';
import { SmallScreenGate } from '@/components/SmallScreenGate';
import { AppShell } from '@/components/AppShell';
import { AppBackground } from '@/components/AppBackground';
import { DayAdvanceFlash } from '@/components/DayAdvanceFlash';
import { PassKeyGate } from '@/components/passkey/PassKeyGate';
import { AccessMenu } from '@/components/AccessMenu';
import { ScreenTransition } from '@/components/ScreenTransition';

// Code-split non-critical screens. These never render on first paint
// and only ~5-15% of sessions need each, so excluding them from the
// initial JS keeps the home → simulation flow fast. React.lazy returns
// a Promise<{ default }> so we wrap the named exports.
const EventModal = lazy(() =>
  import('@/screens/EventModal').then((m) => ({ default: m.EventModal })),
);
const EvaluationScreen = lazy(() =>
  import('@/screens/EvaluationScreen').then((m) => ({ default: m.EvaluationScreen })),
);
const FinalResultsScreen = lazy(() =>
  import('@/screens/FinalResultsScreen').then((m) => ({ default: m.FinalResultsScreen })),
);

export default function App() {
  const screen = useGame((s) => s.meta.screen);
  const ended = useGame((s) => s.meta.ended);
  const pendingEval = useGame((s) => s.meta.pendingEvalPhase);
  const pendingEvent = useGame((s) => s.meta.pendingEventId);
  const sequenceActive = useGame((s) => s.meta.sequenceActive);
  const setScreen = useGame((s) => s.setScreen);
  const pushMascot = useGame((s) => s.pushMascot);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);
  const segment = useGame((s) => s.market.targetSegment);
  const cash = useGame((s) => s.player.cash);
  const finished = useGame((s) => s.inventory.totalFinished);
  // Engine writes via apply elsewhere; not needed in App effects.

  // Promote evaluation/final/screens automatically based on engine signals.
  // Skipped while the unified PhaseSequenceModal owns the flow — that modal
  // handles event + evaluation + result inline, so we don't want App to
  // hijack the screen out from under it.
  useEffect(() => {
    if (sequenceActive) return;
    if (pendingEval !== null && screen !== 'evaluation') {
      setScreen('evaluation');
      return;
    }
    // Don't redirect to 'final' from the home screen — the user
    // explicitly clicked "Back to Home" from the results screen and
    // expects to land there. They can reopen the run with Continue
    // or wipe it with Start New Game.
    if (ended && screen !== 'evaluation' && screen !== 'final' && screen !== 'start') {
      setScreen('final');
    }
  }, [ended, pendingEval, screen, sequenceActive, setScreen]);

  // First-time onboarding: full Amelia intro script. Fires once per
  // run on first entry to the simulation. Uses pushMascotSequence so
  // Previous/Next is enabled in the dialogue overlay.
  useEffect(() => {
    if (screen === 'simulation' && day === 1) {
      pushMascotSequence(expandScript(SCRIPT_INTRO));
    }
  }, [screen, day, pushMascotSequence]);

  // Phase milestones — debrief at end of Phase 1, intros for 2 and 3,
  // and final summary on the results screen. The scripts contain
  // multiple messages each so users get full Previous/Next navigation.
  useEffect(() => {
    if (screen !== 'simulation') return;
    // Keyed on PHASE ENTRY, not a day window. `advanceFinlitPhase` sets
    // `day = phase * 30`, so the day is 30/60/90 and the next confirm jumps it
    // straight past — 31-32 and 61-62 are never observed on a rendered frame,
    // which left both of these coaching scripts as dead code that had never
    // played. `seenScripts` de-dupes, so each still fires exactly once.
    if (phase === 2) {
      pushMascotSequence(expandScript(SCRIPT_AFTER_PHASE1));
      pushMascotSequence(expandScript(SCRIPT_PHASE2_START));
    }
    if (phase === 3) {
      pushMascotSequence(expandScript(SCRIPT_PHASE3_START));
    }
  }, [screen, phase, pushMascotSequence]);

  useEffect(() => {
    if (screen === 'final') {
      pushMascotSequence(expandScript(SCRIPT_FINAL));
    }
  }, [screen, pushMascotSequence]);

  // Dynamic feedback rules — replaces the old "random hint at day N"
  // approach. Reads live state and pushes the most relevant warning or
  // hint (one per evaluation) based on what's actually happening.
  useEffect(() => {
    if (screen !== 'simulation') return;
    const messages = evaluateFeedback(useGame.getState(), 1);
    for (const m of messages) pushMascot(m);
  }, [screen, day, cash, segment, finished, pushMascot]);

  // Phase rollover → re-route to PhaseIntroScreen so each phase feels like a chapter
  const lastSeenPhase = useGame((s) => s.meta.phase);
  useEffect(() => {
    if (screen !== 'simulation') return;
    // When phase has flipped (engine sets meta.phase in dayTick) and we already
    // are in simulation, briefly pop the intro by switching screens.
    // We rely on `evaluations.resolved` ordering — only show if at least one
    // evaluation just landed.
    void lastSeenPhase;
  }, [phase, screen, lastSeenPhase]);

  return (
    <AppShell>
      <PassKeyGate>
      <SmallScreenGate>
        <div className="relative w-full h-screen overflow-hidden">
          <AppBackground />
          {/* Always-mounted screens beneath modals */}
          {screen === 'start' && <StartScreen />}
          {screen === 'route' && <RouteChoiceScreen />}
          {screen === 'phase_intro' && <PhaseIntroScreen />}
          {(screen === 'simulation' || screen === 'evaluation' || screen === 'final') && <SimulationScreen />}

          {/* Overlays. Each lazy-loaded chunk wraps in <Suspense fallback={null}>
              so the surrounding UI keeps rendering while the chunk fetches.
              The fallback is null because these are short-lived modals and
              showing a flash of "loading…" would be more disruptive than
              just letting the modal pop in once ready (typically < 100ms). */}
          {pendingEvent && !sequenceActive && (
            <Suspense fallback={null}><EventModal /></Suspense>
          )}
          {pendingEval !== null && screen === 'evaluation' && !sequenceActive && (
            <Suspense fallback={null}><EvaluationScreen /></Suspense>
          )}
          {screen === 'final' && (
            <Suspense fallback={null}><FinalResultsScreen /></Suspense>
          )}

          {/* First decision of a run: pick the target audience (drives demand
              + fit). Dismissible; also changeable on the Business page. */}

          {/* The phase-intro hero screen has its own big mascot, so suppress
              the dialogue-bubble mascot there (avoids two Amelias + its scrim
              dimming the hero).

              Suppressed on every RESULTS surface for the same reason - the
              phase sequence, the standalone evaluation and the final score.
              Each is a focused flow whose whole purpose is a screen of numbers
              to read, and the mascot's scrim dims exactly that. The queue also
              persists, so a script the player skipped earlier (a route-choice
              line, say) resurfaces at the next screen that allows the mascot
              and talks over an evaluation it has nothing to do with. */}
          {screen !== 'phase_intro'
            && screen !== 'evaluation'
            && screen !== 'final'
            && !sequenceActive
            && <VisualNovelMascot />}
          {/* Opens only when the run has no target audience — a migrated save,
              or a player who cleared theirs. A fresh game derives one from the
              starter genre, so it stays silent there. It shipped orphaned in the
              vendor drop: the file existed but nothing ever rendered it. */}
          <AudiencePickerModal />
          <DayAdvanceFlash />
          {/* Pixel-wipe transition on the big moments: game start, each
              round/phase change, and game end. */}
          <ScreenTransition />
          <Toast />

          {/* Global, low-hierarchy "log out → re-enter pass key" control. Only
              mounts inside the unlocked app (it's a child of PassKeyGate).
              During the run the logout lives in the TopHUD toolbar instead, so
              this floating pill only shows on screens whose bottom-left corner
              is free (it would otherwise overlap the phase bar). */}
          {(screen === 'start' || screen === 'route' || screen === 'phase_intro') && <AccessMenu />}

          {/* Dev-only build/seed stamp. Hidden in production so a class demo
              never shows an internal version string and the run's RNG seed —
              and so the one deliberately-faint element in the app stops being
              the only thing failing a contrast audit. */}
          {(import.meta as { env?: { DEV?: boolean } }).env?.DEV && (
            <div className="fixed bottom-1 right-2 pixel-caption text-ink-700/50 pointer-events-none select-none">
              v0.1 · seed {useGame.getState().meta.seed.slice(0, 14)}
            </div>
          )}
        </div>
      </SmallScreenGate>
      </PassKeyGate>
    </AppShell>
  );
}
