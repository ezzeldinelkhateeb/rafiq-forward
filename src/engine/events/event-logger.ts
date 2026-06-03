/**
 * Event Logger — writes events to the `events` table in Supabase.
 * All writes are fire-and-forget (non-blocking).
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { RafiqEventType, RafiqEvent } from "./event-types";

/**
 * Log a single event to the events table.
 * Designed to be called fire-and-forget: `void logEvent(...)`.
 */
export async function logEvent(
  userId: string,
  eventType: RafiqEventType,
  payload: Record<string, unknown> = {}
): Promise<RafiqEvent | null> {
  try {
    const { data, error } = await (supabaseAdmin
      .from("events" as any)
      .insert({
        user_id: userId,
        event_type: eventType,
        payload,
      })
      .select("id, user_id, event_type, payload, created_at")
      .single() as any);

    if (error) {
      console.error(`[event-logger] Failed to log ${eventType}:`, error.message);
      return null;
    }

    return data as RafiqEvent;
  } catch (e: unknown) {
    console.error(
      `[event-logger] Unexpected error logging ${eventType}:`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * Fetch recent events for a user, optionally filtered by type and time range.
 */
export async function consumeEvents(
  userId: string,
  options?: {
    since?: string;       // ISO timestamp
    types?: RafiqEventType[];
    limit?: number;
  }
): Promise<RafiqEvent[]> {
  const { since, types, limit = 100 } = options ?? {};

  let query = (supabaseAdmin
    .from("events" as any)
    .select("id, user_id, event_type, payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit) as any);

  if (since) {
    query = query.gte("created_at", since);
  }

  if (types && types.length > 0) {
    query = query.in("event_type", types);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[event-logger] Failed to consume events:", error.message);
    return [];
  }

  return (data ?? []) as RafiqEvent[];
}
