/**
 * Typed select helpers for Supabase queries.
 *
 * Goals:
 *  1. Column lists are checked at compile time — passing a column that
 *     doesn't exist on the table's Row is a TS error, not a silent
 *     `SelectQueryError<...>` at runtime.
 *  2. The awaited `data` is `Pick<Row, C[number]>` (or array of it), never
 *     the `SelectQueryError<string>` shape that supabase-js falls back to
 *     when the select string is invalid.
 *  3. Full chainability preserved — `.eq()`, `.order()`, `.limit()`,
 *     `.single()`, `.maybeSingle()` all keep working with proper types.
 *
 * Usage:
 *   const { data, error } = await selectFrom("identity_memory", [
 *     "goals", "struggles", "personality",
 *   ] as const)
 *     .eq("user_id", userId)
 *     .single();
 *   // data: { goals: string[]; struggles: string[]; personality: string | null } | null
 *
 *   // Passing a non-existent column is a compile error:
 *   selectFrom("identity_memory", ["nope"] as const); // ❌ TS error
 */

import type {
  PostgrestFilterBuilder,
  PostgrestQueryBuilder,
} from "@supabase/postgrest-js";
import { supabaseAdmin } from "./client.server";
import type { Database } from "./types";

type Schema = Database["public"];
type Tables = Schema["Tables"];
type TableName = keyof Tables & string;
type Row<T extends TableName> = Tables[T]["Row"];
type Column<T extends TableName> = keyof Row<T> & string;

/** The row shape after picking only the requested columns. */
export type PickedRow<
  T extends TableName,
  C extends ReadonlyArray<Column<T>>,
> = Pick<Row<T>, C[number]>;

/**
 * Derive the ClientOptions generic from the generated Database type so the
 * builder types stay consistent with the rest of the supabase-js client.
 */
type ClientOptions = Database extends { __InternalSupabase: infer I }
  ? I extends Record<string, unknown>
    ? I
    : Record<string, never>
  : Record<string, never>;

/**
 * The shape we hand back to callers. By replacing the `Result` generic with
 * `PickedRow<T, C>[]`, supabase-js can no longer collapse the awaited `data`
 * into `SelectQueryError<...>` — every awaited result is a real array of
 * picked rows (or `null` for single).
 */
export type TypedSelectBuilder<
  T extends TableName,
  C extends ReadonlyArray<Column<T>>,
> = PostgrestFilterBuilder<
  ClientOptions,
  Schema,
  Row<T>,
  PickedRow<T, C>[],
  T,
  Tables[T] extends { Relationships: infer R } ? R : unknown
>;

type QueryBuilderOf<T extends TableName> = PostgrestQueryBuilder<
  ClientOptions,
  Schema,
  Tables[T],
  T,
  Tables[T] extends { Relationships: infer R } ? R : unknown
>;

/**
 * Build a typed select against a public-schema table using the admin client.
 *
 * `columns` MUST be a `readonly` tuple of column names (use `as const` or
 * declare with `as const satisfies readonly Column<T>[]`). The tuple is
 * what gives us literal column names to feed into `Pick<Row, ...>`.
 */
export function selectFrom<
  T extends TableName,
  const C extends ReadonlyArray<Column<T>>,
>(table: T, columns: C): TypedSelectBuilder<T, C> {
  const qb = supabaseAdmin.from(table) as unknown as QueryBuilderOf<T>;
  return qb.select(columns.join(", ")) as unknown as TypedSelectBuilder<T, C>;
}

/**
 * Same as `selectFrom`, but takes an explicit Supabase client — use this
 * inside server functions guarded by `requireSupabaseAuth`, where the
 * authenticated `supabase` client comes from `context`.
 */
export function selectFromWith<
  T extends TableName,
  const C extends ReadonlyArray<Column<T>>,
>(
  client: {
    from: (table: T) => unknown;
  },
  table: T,
  columns: C,
): TypedSelectBuilder<T, C> {
  const qb = client.from(table) as QueryBuilderOf<T>;
  return qb.select(columns.join(", ")) as unknown as TypedSelectBuilder<T, C>;
}
