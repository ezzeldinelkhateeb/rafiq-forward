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

      const rafiqMsgId = crypto.randomUUID();
      const placeholderMsg: ChatMessage = {
        id: rafiqMsgId,
        role: "rafiq",
        text: "",
        actionDone: false,
      };
      setMessages((m) => [...m, placeholderMsg]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            sessionId,
            userText: trimmed,
            persona,
            recentMessageCount: messages.filter((m) => m.role === "user").length,
            consecutiveAdviceCount: consecutiveAdviceCountRef.current,
          }),
        });

        if (!response.ok) {
          throw new Error("فشل الاتصال بـ رفيق. حاول تاني.");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("عطل في نظام البث المباشر.");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let isThinkingCleared = false;
        let finalMetadata: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Parse metadata if present at the end
          let metadata: any = null;
          let cleanBuffer = buffer;
          if (buffer.includes("__METADATA__")) {
            const parts = buffer.split("__METADATA__");
            cleanBuffer = parts[0];
            try {
              metadata = JSON.parse(parts[1]);
              finalMetadata = metadata;
            } catch {}
          }

          // Parse partial JSON stream
          const parsed = parsePartialJson(cleanBuffer);

          if (parsed.validate && !isThinkingCleared) {
            setThinking(false);
            isThinkingCleared = true;
          }

          // Update message state in real-time
          setMessages((prev) =>
            prev.map((m) =>
              m.id === rafiqMsgId
                ? {
                    ...m,
                    text: parsed.validate || cleanBuffer.slice(0, 150),
                    reframe: parsed.reframe || undefined,
                    action: parsed.action || undefined,
                    mode: metadata?.mode || m.mode,
                    emotionalTag: metadata?.emotionalTag || m.emotionalTag,
                    id: metadata?.id || rafiqMsgId,
                  }
                : m
            )
          );
        }

        // Final check on advice count for pacing
        setMessages((prev) => {
          const finalMsg = prev.find((m) => m.id === rafiqMsgId || (finalMetadata && m.id === finalMetadata.id));
          const modeUsed = finalMsg?.mode;
          if (modeUsed === "validate_reframe_act") {
            consecutiveAdviceCountRef.current += 1;
          } else {
            consecutiveAdviceCountRef.current = 0;
          }
          return prev;
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "حصل خطأ غير متوقع.");
        // Remove the empty placeholder if request failed completely
        setMessages((m) => m.filter((msg) => msg.id !== rafiqMsgId));
      } finally {
        setThinking(false);
      }
    },
    [thinking, messages]
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

// ─── Partial JSON Streaming Parser ──────────────────────────────────────────

function parsePartialJson(streamText: string) {
  let validate = "";
  let reframe = "";
  let action = "";

  const trimmed = streamText.trim();

  // If not a JSON response, fallback to treating raw text as validation content
  if (!trimmed.startsWith("{") && !trimmed.includes('"validate"')) {
    return { validate: trimmed, reframe: "", action: "" };
  }

  // Extract validate field
  const valClosed = trimmed.match(/"validate"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (valClosed) {
    validate = valClosed[1];
  } else {
    const valOpen = trimmed.match(/"validate"\s*:\s*"([^"]*)$/);
    if (valOpen) validate = valOpen[1];
  }

  // Extract reframe field
  const refClosed = trimmed.match(/"reframe"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (refClosed) {
    reframe = refClosed[1];
  } else {
    const refOpen = trimmed.match(/"reframe"\s*:\s*"([^"]*)$/);
    if (refOpen) reframe = refOpen[1];
  }

  // Extract action field
  const actClosed = trimmed.match(/"action"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (actClosed) {
    action = actClosed[1];
  } else {
    const actOpen = trimmed.match(/"action"\s*:\s*"([^"]*)$/);
    if (actOpen) action = actOpen[1];
  }

  // Clean escape characters
  validate = validate.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  reframe = reframe.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  action = action.replace(/\\n/g, "\n").replace(/\\"/g, '"');

  return { validate, reframe, action };
}
