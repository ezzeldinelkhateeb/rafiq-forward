/**
 * useSession — manages anonymous-first user identity.
 *
 * Flow:
 * 1. Check localStorage for rafiq.user.id
 * 2. If missing, generate a UUID and store it
 * 3. Call resolveSession() on server to upsert user + create session
 * 4. Return { userId, sessionId, user, isLoading }
 *
 * Future-ready: Supabase Auth linkage via updateUserAuthId().
 */

import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveSession, updatePersona, fireSessionStartEvents } from "@/functions/session.fn";
import type { RafiqUser, RafiqSession, Persona } from "@/types/companion";

const USER_KEY = "rafiq.user.id";
const PERSONA_KEY = "rafiq.persona";

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

function getSavedPersona(): Persona {
  const saved = localStorage.getItem(PERSONA_KEY) as Persona | null;
  return saved ?? "friend";
}

export interface SessionState {
  userId: string;
  sessionId: string;
  user: RafiqUser | null;
  session: RafiqSession | null;
  persona: Persona;
  isReady: boolean;
  setPersona: (p: Persona) => void;
}

export function useSession(): SessionState {
  const callResolveSession = useServerFn(resolveSession);
  const callUpdatePersona = useServerFn(updatePersona);
  const callFireSessionStartEvents = useServerFn(fireSessionStartEvents);

  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [user, setUser] = useState<RafiqUser | null>(null);
  const [session, setSession] = useState<RafiqSession | null>(null);
  const [persona, setPersonaState] = useState<Persona>("friend");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const uid = getOrCreateUserId();
    const p = getSavedPersona();
    setUserId(uid);
    setPersonaState(p);

    callResolveSession({ data: { userId: uid, persona: p } })
      .then(({ user, session }) => {
        setUser(user);
        setSession(session);
        setSessionId(session.id);
        setIsReady(true);
        // Fire session start events (sleep check, absence, etc.)
        callFireSessionStartEvents({ data: { userId: uid } }).catch(() => {});
      })
      .catch(() => {
        // Fallback: use local UUID only, session-less mode
        setSessionId(crypto.randomUUID());
        setIsReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPersona = useCallback(
    (p: Persona) => {
      setPersonaState(p);
      if (typeof window !== "undefined") {
        localStorage.setItem(PERSONA_KEY, p);
      }
      // Sync persona to server (fire-and-forget)
      if (userId) {
        callUpdatePersona({ data: { userId, persona: p } }).catch(() => {});
      }
    },
    [userId, callUpdatePersona]
  );

  return { userId, sessionId, user, session, persona, isReady, setPersona };
}
