/**
 * useRafiqChat — the full chat state machine.
 *
 * Manages:
 * - Message history (in-session)
 * - Thinking/loading state
 * - Consecutive advice count (for diversity engine)
 * - Action confirmation
 * - Error handling
 */

import { useState, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateRafiqReply } from "@/functions/chat.fn";
import { confirmActionDone } from "@/functions/action.fn";
import type { RafiqReply, Persona } from "@/types/companion";

// ─── Message type for UI ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "rafiq";
  text: string;
  reframe?: string;
  action?: string;
  actionDone?: boolean;
  mode?: string;
  emotionalTag?: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface RafiqChatState {
  messages: ChatMessage[];
  thinking: boolean;
  error: string | null;
  send: (text: string, userId: string, sessionId: string, persona: Persona) => Promise<void>;
  markActionDone: (msgId: string, userId: string) => Promise<void>;
  clearError: () => void;
}

export function useRafiqChat(): RafiqChatState {
  const callGenerateReply = useServerFn(generateRafiqReply);
  const callConfirmAction = useServerFn(confirmActionDone);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track advice repetition for response diversity engine
  const consecutiveAdviceCountRef = useRef(0);

  const send = useCallback(
    async (
      text: string,
      userId: string,
      sessionId: string,
      persona: Persona
    ) => {
      const trimmed = text.trim();
      if (!trimmed || thinking || !userId || !sessionId) return;

      setError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
      };

      setMessages((m) => [...m, userMsg]);
      setThinking(true);

      // Minimum thinking time — feels more human, less machine
      const start = Date.now();

      let reply: RafiqReply;
      try {
        reply = await callGenerateReply({
          data: {
            userId,
            sessionId,
            userText: trimmed,
            persona,
            recentMessageCount: messages.filter((m) => m.role === "user")
              .length,
            consecutiveAdviceCount: consecutiveAdviceCountRef.current,
          },
        });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "حصل خطأ غير متوقع.";
        setError(msg);
        setThinking(false);
        return;
      }

      // Enforce minimum 2s thinking time for UX believability
      const elapsed = Date.now() - start;
      if (elapsed < 2000) {
        await new Promise((r) => setTimeout(r, 2000 - elapsed));
      }

      // Update consecutive advice count
      if (reply.mode === "validate_reframe_act") {
        consecutiveAdviceCountRef.current += 1;
      } else {
        consecutiveAdviceCountRef.current = 0;
      }

      const rafiqMsg: ChatMessage = {
        id: reply.id,
        role: "rafiq",
        text: reply.text,
        reframe: reply.reframe,
        action: reply.action,
        actionDone: false,
        mode: reply.mode,
        emotionalTag: reply.emotionalTag,
      };

      setMessages((m) => [...m, rafiqMsg]);
      setThinking(false);
    },
    [thinking, messages, callGenerateReply]
  );

  const markActionDone = useCallback(
    async (msgId: string, userId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && !m.actionDone ? { ...m, actionDone: true } : m
        )
      );

      try {
        await callConfirmAction({ data: { interactionId: msgId, userId } });
      } catch {
        // Non-blocking — UI already updated optimistically
      }
    },
    [callConfirmAction]
  );

  const clearError = useCallback(() => setError(null), []);

  return { messages, thinking, error, send, markActionDone, clearError };
}
