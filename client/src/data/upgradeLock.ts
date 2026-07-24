// Lock + visibility evaluation for upgrades. Used by Operations and
// Commercial panels. Centralised so the same rules apply everywhere and
// reasons surface consistently.

import { UPGRADES } from './upgrades';
import { phaseOf } from '@/utils/format';
import type { UpgradeDef } from '@/types';

export type LockState =
  | { locked: false }
  | { locked: true; reason: string; kind: 'phase' | 'prereq' };

/**
 * Evaluate whether an upgrade is currently locked, and produce a
 * player-facing reason string when it is.
 *
 * Order of checks:
 *   1. Phase gate — `phaseOf(unlockDay) > currentPhase`
 *      → "Unlocks in Phase X"
 *   2. Prerequisite gate — every id in `requires` must already be acquired
 *      → "Requires: <Name> first."
 */
export function evaluateLock(
  u: UpgradeDef,
  currentPhase: 1 | 2 | 3,
  acquired: string[],
): LockState {
  const unlockPhase = u.unlockDay ? phaseOf(u.unlockDay) : 1;
  if (unlockPhase > currentPhase) {
    return {
      locked: true,
      reason: `Unlocks in Phase ${unlockPhase}`,
      kind: 'phase',
    };
  }
  if (u.requires && u.requires.length > 0) {
    const missing = u.requires.filter((id) => !acquired.includes(id));
    if (missing.length > 0) {
      const missingNames = missing
        .map((id) => UPGRADES.find((x) => x.id === id)?.name ?? id)
        .join(', ');
      return {
        locked: true,
        reason: `Requires: ${missingNames} first.`,
        kind: 'prereq',
      };
    }
  }
  return { locked: false };
}

/**
 * Visibility tiers — three states instead of just locked/unlocked:
 *
 *   visible — playable now (not locked)
 *   locked  — visible but greyed out, surfaces what's possible
 *   hidden  — not rendered at all (avoids clutter when an upgrade is
 *             irrelevant to the current phase / chain)
 *
 * Rules:
 *   - Phase 1 keeps the panel uncluttered: any locked upgrade is HIDDEN.
 *     Players see only the root upgrades they can actually pursue this phase.
 *   - Phase 2+ shows locked children so the player sees the dependency
 *     tree. If hire_helper is acquired but tool_basic isn't, the
 *     "Production Press" still shows as locked with the prereq message.
 *   - An upgrade whose prereq is itself hidden stays hidden — we never
 *     show a locked grandchild whose parent isn't even visible.
 */
export type UpgradeVisibility = 'visible' | 'locked' | 'hidden';

export function getUpgradeVisibility(
  u: UpgradeDef,
  currentPhase: 1 | 2 | 3,
  acquired: string[],
): UpgradeVisibility {
  const lock = evaluateLock(u, currentPhase, acquired);
  if (!lock.locked) return 'visible';
  // Phase 1: keep the panel clean — hide everything that's locked,
  // regardless of reason. The player only sees their actual menu of
  // options for this phase.
  if (currentPhase === 1) return 'hidden';
  // Phase 2+: surface the dependency tree. Show locked items with their
  // prereq text so the player learns what comes next.
  return 'locked';
}

/**
 * Resolve the (single) parent upgrade of an item — the first entry in
 * its `requires` list, when present. Used by the UI to render children
 * indented under their parent.
 */
export function parentOf(u: UpgradeDef): UpgradeDef | undefined {
  if (!u.requires || u.requires.length === 0) return undefined;
  return UPGRADES.find((x) => x.id === u.requires![0]);
}
