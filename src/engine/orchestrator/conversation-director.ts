import type { UserBehaviorState } from "@/types/behavioral";
import type { DynamicStance } from "./dynamic-stance";

export type DialogueAct =
  | "interrupt"
  | "silence"
  | "callback"
  | "tease"
  | "mirror"
  | "challenge"
  | "refuse"
  | "close_loop"
  | "soft_presence"
  | "move"
  | "question"
  | "celebrate"
  | "recall"
  | "observe";

export interface ConversationDirectorOutput {
  dialogueAct: DialogueAct;
  warmth: number;
  pressure: number;
  maxWords: number;
  allowAction: boolean;
  imperfectionLevel: number;
  endingType: "open" | "closed" | "question" | "silence";
}

/**
 * Directs the conversation dynamically on every turn.
 * Replaces the static ResponseMode templates with organic, granular Dialogue Acts.
 */
export function directConversation(params: {
  behaviorState: UserBehaviorState;
  stance: DynamicStance;
  consecutiveAdviceCount: number;
  userMessageLength: number;
  hoursSinceLastSession: number;
  hasUnfinishedAction: boolean;
  lastActionDone: boolean;
  isActionCompletion?: boolean;
}): ConversationDirectorOutput {
  const {
    behaviorState,
    stance,
    consecutiveAdviceCount,
    userMessageLength,
    hoursSinceLastSession,
    hasUnfinishedAction,
    lastActionDone,
    isActionCompletion,
  } = params;

  // Defaults
  let dialogueAct: DialogueAct = "observe";
  let maxWords = 50;
  let allowAction = true;
  let imperfectionLevel = 0.3; // Level of colloquial filler words
  let endingType: "open" | "closed" | "question" | "silence" = "open";

  // 1. Priority Triggers
  if (isActionCompletion || (lastActionDone && hoursSinceLastSession > 0 && hoursSinceLastSession < 48)) {
    dialogueAct = "celebrate";
    maxWords = 35;
  } else if (hoursSinceLastSession > 48) {
    dialogueAct = "callback";
    maxWords = 40;
  } else if (behaviorState === "digital_escape") {
    dialogueAct = "interrupt";
    maxWords = 15;
    allowAction = true;
    endingType = "closed";
  } else if (behaviorState === "emotional_collapse") {
    dialogueAct = "soft_presence";
    maxWords = 25;
    allowAction = false;
    endingType = "open";
  } else if (behaviorState === "stuck") {
    if (stance.directness > 0.8) {
      dialogueAct = "challenge";
    } else {
      dialogueAct = "tease";
    }
    maxWords = 35;
  } else if (consecutiveAdviceCount >= 2) {
    // Advice fatigue guard -> Ask a single sharp question instead of giving advice
    dialogueAct = "question";
    maxWords = 20;
    allowAction = false;
    endingType = "question";
  } else {
    // 2. Stance-Based Acts
    if (stance.pressure > 0.7) {
      dialogueAct = "challenge";
    } else if (stance.depth > 0.7) {
      dialogueAct = "mirror";
      maxWords = 60;
    } else if (stance.playfulness > 0.7) {
      dialogueAct = "tease";
    } else if (userMessageLength < 15) {
      dialogueAct = "question";
      endingType = "question";
    } else {
      dialogueAct = "observe";
    }
  }

  // Allow action overrides
  if (dialogueAct === "silence" || dialogueAct === "soft_presence" || dialogueAct === "mirror" || dialogueAct === "question") {
    allowAction = false;
  }

  // Adjust parameters based on stance
  const warmth = stance.warmth;
  const pressure = stance.pressure;

  if (dialogueAct === "interrupt") {
    maxWords = 12;
  } else if (dialogueAct === "silence") {
    maxWords = 3;
    endingType = "silence";
  } else if (dialogueAct === "question") {
    endingType = "question";
  }

  return {
    dialogueAct,
    warmth,
    pressure,
    maxWords,
    allowAction,
    imperfectionLevel,
    endingType,
  };
}
