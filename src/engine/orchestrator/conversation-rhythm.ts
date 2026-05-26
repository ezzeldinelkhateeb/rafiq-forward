import type { ResponseMode } from "@/types/companion";

// Pacing categorizations
const LONG_TEXT_MODES: ResponseMode[] = [
  "validate_reframe_act",
  "deep_reflection",
  "micro_story",
  "tough_love",
];

const SHORT_INTERACTIVE_MODES: ResponseMode[] = [
  "question_only",
  "quiet_presence",
  "playful_observation",
  "observation",
];

/**
 * Regulates the conversation rhythm and pacing.
 * Filters the list of candidate modes based on history to avoid template fatigue.
 *
 * @param candidates The list of candidate modes matching current rules
 * @param history The history of response modes used in this session (ordered newest first)
 */
export function selectBestModeByRhythm(
  candidates: ResponseMode[],
  history: ResponseMode[]
): ResponseMode {
  if (candidates.length === 0) return "validate_reframe_act";
  if (candidates.length === 1) return candidates[0];

  // Rule 1: Never allow the exact same mode consecutively
  let filtered = candidates;
  if (history.length > 0) {
    const lastMode = history[0];
    filtered = filtered.filter((m) => m !== lastMode);
  }

  // Rule 2: Try to avoid repeating any of the last 3 modes
  if (history.length > 0) {
    const lastThree = history.slice(0, 3);
    const subset = filtered.filter((m) => !lastThree.includes(m));
    if (subset.length > 0) {
      filtered = subset;
    }
  }

  // Rule 2.5: Pacing streak breaking. If the last 3 modes are all in the same pacing category, force a change.
  if (history.length >= 3) {
    const lastThree = history.slice(0, 3);
    const allLong = lastThree.every((m) => LONG_TEXT_MODES.includes(m));
    const allShort = lastThree.every((m) => SHORT_INTERACTIVE_MODES.includes(m));

    if (allLong) {
      const shortCandidates = filtered.filter((m) => SHORT_INTERACTIVE_MODES.includes(m));
      if (shortCandidates.length > 0) {
        filtered = shortCandidates;
      }
    } else if (allShort) {
      const longCandidates = filtered.filter((m) => LONG_TEXT_MODES.includes(m));
      if (longCandidates.length > 0) {
        filtered = longCandidates;
      }
    }
  }

  // Rule 3: Rotate pacing. If the last mode was long/heavy, prefer a short/interactive mode
  if (history.length > 0 && LONG_TEXT_MODES.includes(history[0])) {
    const shortCandidates = filtered.filter((m) =>
      SHORT_INTERACTIVE_MODES.includes(m)
    );
    if (shortCandidates.length > 0) {
      // Pick one randomly or deterministic rotation
      const index = Math.floor(Math.random() * shortCandidates.length);
      return shortCandidates[index];
    }
  }

  // Rule 4: If the last mode was short/interactive, prefer a long/heavy mode to go deeper
  if (history.length > 0 && SHORT_INTERACTIVE_MODES.includes(history[0])) {
    const longCandidates = filtered.filter((m) =>
      LONG_TEXT_MODES.includes(m)
    );
    if (longCandidates.length > 0) {
      const index = Math.floor(Math.random() * longCandidates.length);
      return longCandidates[index];
    }
  }

  // Default: return the first remaining candidate
  return filtered[0] || candidates[0];
}
