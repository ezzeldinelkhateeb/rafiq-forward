/**
 * Session Server Functions — user identity management.
 *
 * Architecture: anonymous-first, future Supabase Auth linkable.
 * Flow: localStorage UUID → Supabase users row → session row
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEvent } from "@/engine/events/event-logger";
import { runSessionStartEvents } from "@/engine/events/session-start-events";
import type { RafiqUser, RafiqSession } from "@/types/companion";

// ─── Resolve or Create User ────────────────────────────────────────────────

/**
 * Called on every page load.
 * If user doesn't exist in DB → creates one.
 * If exists → updates last_seen_at.
 * Returns the user record + a new session record.
 */
export const resolveSession = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; persona: string }) => input
  )
  .handler(
    async ({ data }): Promise<{ user: RafiqUser; session: RafiqSession }> => {
      const { userId, persona } = data;

      // ── 1. Upsert user ───────────────────────────────────────────────
      const { data: user, error: userErr } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            id: userId,
            preferred_persona: persona,
            last_seen_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
            ignoreDuplicates: false,
          }
        )
        .select("id, created_at, last_seen_at, display_name, preferred_persona")
        .single();

      if (userErr || !user) {
        throw new Error(`Failed to resolve user: ${userErr?.message}`);
      }

      // ── 2. Create session ────────────────────────────────────────────
      const { data: session, error: sessionErr } = await supabaseAdmin
        .from("sessions")
        .insert({ user_id: userId })
        .select("id, user_id, created_at, message_count")
        .single();

      if (sessionErr || !session) {
        throw new Error(`Failed to create session: ${sessionErr?.message}`);
      }

      return {
        user: {
          id: user.id,
          preferredPersona: user.preferred_persona as "sage" | "coach" | "friend",
          displayName: user.display_name ?? undefined,
          createdAt: user.created_at,
          lastSeenAt: user.last_seen_at,
        },
        session: {
          id: session.id,
          userId: session.user_id,
          createdAt: session.created_at,
          messageCount: session.message_count,
        },
      };

      // ── 3. Fire session-start behavioral events (fire-and-forget) ────
      // Runs AFTER response is already being returned to avoid blocking UX
    }
  );

// ─── Fire Session Start Events (called post-resolve) ───────────────────────

/**
 * Called from the client after session resolves successfully.
 * Fires behavioral events: sleep check, absence detection, late-night signal.
 * Non-blocking — does NOT affect session resolution speed.
 */
export const fireSessionStartEvents = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const { userId } = data;
    const hourOfDay = new Date().getHours();

    // Fire all session-start behavioral events
    void runSessionStartEvents(userId);

    // Log session_start event
    void logEvent(userId, "session_start", { hourOfDay });

    // Log late_night_session if applicable
    if (hourOfDay >= 23 || hourOfDay <= 4) {
      void logEvent(userId, "late_night_session", { hourOfDay });
    }

    return { ok: true };
  });

// ─── Update Persona Preference ─────────────────────────────────────────────

export const updatePersona = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; persona: string }) => input)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ preferred_persona: data.persona })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
