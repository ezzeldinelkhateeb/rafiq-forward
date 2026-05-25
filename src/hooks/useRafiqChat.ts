/**
 * useRafiqChat — chat state with action-loop continuity.
 *
 * Action lifecycle:
 *  - send(): user → Rafiq reply (validate/reframe/action)
 *  - confirmAction(): marks action done, immediately appends a new Rafiq
 *    "celebrate + next micro-step" message
 *  - swapAlternative(): replaces the current message's action with an easier
 *    alternative path (in-place swap, no new message)
 */

import { useState, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateRafiqReply } from "@/functions/chat.fn";
import {
  confirmAndContinue,
  regenerateAlternative,
} from "@/functions/followup.fn";
import type { RafiqReply, Persona } from "@/types/companion";

export interface ChatMessage {
  id: string;
  role: "user" | "rafiq";
  text: string;
  reframe?: string;
  action?: string;
  actionDone?: boolean;
  alternativeTried?: boolean;
  mode?: string;
  emotionalTag?: string;
}

export interface RafiqChatState {
  messages: ChatMessage[];
  thinking: boolean;
  error: string | null;
  send: (text: string, userId: string, sessionId: string, persona: Persona) => Promise<void>;
  confirmAction: (
    msgId: string,
    userId: string,
    sessionId: string,
    persona: Persona
  ) => Promise<void>;
  swapAlternative: (msgId: string, userId: string, persona: Persona) => Promise<void>;
  clearError: () => void;
}

export function useRafiqChat(): RafiqChatState {
  const callGenerateReply = useServerFn(generateRafiqReply);
  const callConfirm = useServerFn(confirmAndContinue);
  const callAlternative = useServerFn(regenerateAlternative);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const start = Date.now();
      let reply: RafiqReply;
      try {
        reply = await callGenerateReply({
          data: {
            userId,
            sessionId,
            userText: trimmed,
            persona,
            recentMessageCount: messages.filter((m) => m.role === "user").length,
            consecutiveAdviceCount: consecutiveAdviceCountRef.current,
          },
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "حصل خطأ غير متوقع.");
        setThinking(false);
        return;
      }

      const elapsed = Date.now() - start;
      if (elapsed < 1800) await new Promise((r) => setTimeout(r, 1800 - elapsed));

      if (reply.mode === "validate_reframe_act") {
        consecutiveAdviceCountRef.current += 1;
      } else {
        consecutiveAdviceCountRef.current = 0;
      }

      setMessages((m) => [
        ...m,
        {
          id: reply.id,
          role: "rafiq",
          text: reply.text,
          reframe: reply.reframe,
          action: reply.action,
          actionDone: false,
          mode: reply.mode,
          emotionalTag: reply.emotionalTag,
        },
      ]);
      setThinking(false);
    },
    [thinking, messages, callGenerateReply]
  );

  const confirmAction = useCallback(
    async (msgId: string, userId: string, sessionId: string, persona: Persona) => {
      // Optimistic
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, actionDone: true } : m))
      );
      setThinking(true);
      try {
        const reply = await callConfirm({
          data: { interactionId: msgId, userId, sessionId, persona },
        });
        setMessages((m) => [
          ...m,
          {
            id: reply.id,
            role: "rafiq",
            text: reply.text,
            action: reply.action,
            actionDone: false,
            mode: "celebrate",
          },
        ]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "حصل خطأ غير متوقع.");
      } finally {
        setThinking(false);
      }
    },
    [callConfirm]
  );

  const swapAlternative = useCallback(
    async (msgId: string, userId: string, persona: Persona) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, alternativeTried: true } : m))
      );
      setThinking(true);
      try {
        const { action } = await callAlternative({
          data: { interactionId: msgId, userId, persona },
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, action } : m))
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "حصل خطأ غير متوقع.");
      } finally {
        setThinking(false);
      }
    },
    [callAlternative]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    thinking,
    error,
    send,
    confirmAction,
    swapAlternative,
    clearError,
  };
}
