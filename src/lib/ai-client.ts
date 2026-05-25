/**
 * Rafiq AI Client — wraps @google/genai SDK.
 * Single entry point for all LLM calls in the system.
 *
 * Usage:
 *   import { callGemini } from "@/lib/ai-client";
 *   const text = await callGemini({ model, systemInstruction, userMessage, ... });
 */

import { GoogleGenAI } from "@google/genai";
import { AI_CONFIG } from "@/config/ai";

// ─── Client Singleton ────────────────────────────────────────────────────

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env file.\n" +
        "Get a free key at: https://aistudio.google.com/apikey"
    );
  }
  return new GoogleGenAI({ apiKey });
}

// ─── Core Call Interface ─────────────────────────────────────────────────

export interface GeminiCallParams {
  model?: string;
  systemInstruction: string;
  userMessage: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** If true, expects JSON output and parses it */
  expectJson?: boolean;
  /** Optional custom schema for structured JSON output */
  responseSchema?: Record<string, any>;
}

export interface GeminiCallResult {
  text: string;
  /** Parsed JSON if expectJson was true, otherwise undefined */
  json?: Record<string, unknown>;
}

/**
 * Core LLM call — used by all engine modules.
 * Handles errors with user-friendly Arabic messages.
 */
export async function callGemini(
  params: GeminiCallParams
): Promise<GeminiCallResult> {
  const client = getClient();

  const model = params.model ?? AI_CONFIG.PRIMARY_MODEL;
  const temperature = params.temperature ?? AI_CONFIG.TEMPERATURE.COMPANION;
  const maxOutputTokens =
    params.maxOutputTokens ?? AI_CONFIG.MAX_TOKENS.COMPANION;

  try {
    const response = await client.models.generateContent({
      model,
      contents: params.userMessage,
      config: {
        systemInstruction: params.systemInstruction,
        temperature,
        maxOutputTokens,
        ...(params.expectJson
          ? {
              responseMimeType: "application/json",
              responseSchema: params.responseSchema ?? {
                type: "object",
                properties: {
                  validate: { type: "string" },
                  reframe: { type: "string" },
                  action: { type: "string" },
                },
                required: ["validate"],
              },
            }
          : {}),
      },
    });

    const raw = response.text ?? "";

    if (params.expectJson) {
      // Find first '{' and last '}' to extract JSON block robustly
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = raw.slice(firstBrace, lastBrace + 1);
        try {
          const parsed = JSON.parse(jsonCandidate);
          return { text: raw, json: parsed };
        } catch (e) {
          // Attempt trailing comma cleanup
          try {
            const cleaned = jsonCandidate.replace(/,\s*([\]}])/g, '$1');
            const parsed = JSON.parse(cleaned);
            return { text: raw, json: parsed };
          } catch {
            console.error("[ai-client] Robust JSON extraction failed to parse:", jsonCandidate);
          }
        }
      }
      
      // Fallback: simple cleanup
      const cleaned = raw
        .replace(/^```(?:json|js|javascript)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      try {
        return { text: raw, json: JSON.parse(cleaned) };
      } catch {
        return { text: raw, json: undefined };
      }
    }

    return { text: raw };
  } catch (err: unknown) {
    // Map API errors to Arabic user-facing messages
    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err);

    if (message.includes("429") || message.includes("quota")) {
      throw new Error("الطلبات كتيرة دلوقتي، استنى لحظة وحاول تاني.");
    }
    if (message.includes("api_key") || message.includes("unauthorized")) {
      throw new Error("مفتاح API غلط أو منتهي — راجع الإعدادات.");
    }
    if (message.includes("model") && message.includes("not found")) {
      throw new Error(`الموديل "${model}" مش موجود — راجع AI_CONFIG.`);
    }

    // Re-throw for unexpected errors
    throw new Error(
      err instanceof Error ? err.message : "حصل خطأ غير متوقع في الـ AI."
    );
  }
}

/**
 * Lightweight classification call — low temperature, tiny output.
 * Used for emotional state detection and behavioral tagging.
 */
export async function callGeminiClassify(params: {
  systemInstruction: string;
  userMessage: string;
}): Promise<string> {
  const result = await callGemini({
    model: AI_CONFIG.CLASSIFIER_MODEL,
    systemInstruction: params.systemInstruction,
    userMessage: params.userMessage,
    temperature: AI_CONFIG.TEMPERATURE.CLASSIFY,
    maxOutputTokens: AI_CONFIG.MAX_TOKENS.CLASSIFY,
    expectJson: false,
  });
  return result.text.trim();
}

/**
 * Narrative generation call — used for memory snapshot creation.
 * Higher coherence, longer output, runs infrequently.
 */
export async function callGeminiNarrative(params: {
  systemInstruction: string;
  userMessage: string;
}): Promise<string> {
  const result = await callGemini({
    model: AI_CONFIG.NARRATIVE_MODEL,
    systemInstruction: params.systemInstruction,
    userMessage: params.userMessage,
    temperature: AI_CONFIG.TEMPERATURE.NARRATIVE,
    maxOutputTokens: AI_CONFIG.MAX_TOKENS.NARRATIVE,
  });
  return result.text.trim();
}
