export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      behavioral_patterns: {
        Row: {
          confidence: number | null
          created_at: string
          description: string
          first_seen_at: string
          id: string
          last_seen_at: string
          occurrence_count: number
          pattern_type: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          pattern_type: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          pattern_type?: string
          user_id?: string
        }
        Relationships: []
      }
      emotional_timeline: {
        Row: {
          created_at: string
          emotional_state: string
          id: string
          intensity: number | null
          session_id: string | null
          source_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emotional_state: string
          id?: string
          intensity?: number | null
          session_id?: string | null
          source_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emotional_state?: string
          id?: string
          intensity?: number | null
          session_id?: string | null
          source_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      identity_memory: {
        Row: {
          created_at: string
          goals: string[]
          onboarding_done: boolean
          personality: string | null
          preferred_tone: string | null
          sleep_target: string | null
          small_pleasures: string[]
          struggles: string[]
          trigger_words: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goals?: string[]
          onboarding_done?: boolean
          personality?: string | null
          preferred_tone?: string | null
          sleep_target?: string | null
          small_pleasures?: string[]
          struggles?: string[]
          trigger_words?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goals?: string[]
          onboarding_done?: boolean
          personality?: string | null
          preferred_tone?: string | null
          sleep_target?: string | null
          small_pleasures?: string[]
          struggles?: string[]
          trigger_words?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          action: string | null
          action_done: boolean
          action_done_at: string | null
          created_at: string
          emotional_tag: string | null
          id: string
          parent_interaction_id: string | null
          persona: string
          reframe: string | null
          response_mode: string | null
          session_id: string
          session_ref: string | null
          user_id: string | null
          user_text: string
          validate: string | null
        }
        Insert: {
          action?: string | null
          action_done?: boolean
          action_done_at?: string | null
          created_at?: string
          emotional_tag?: string | null
          id?: string
          parent_interaction_id?: string | null
          persona: string
          reframe?: string | null
          response_mode?: string | null
          session_id: string
          session_ref?: string | null
          user_id?: string | null
          user_text: string
          validate?: string | null
        }
        Update: {
          action?: string | null
          action_done?: boolean
          action_done_at?: string | null
          created_at?: string
          emotional_tag?: string | null
          id?: string
          parent_interaction_id?: string | null
          persona?: string
          reframe?: string | null
          response_mode?: string | null
          session_id?: string
          session_ref?: string | null
          user_id?: string | null
          user_text?: string
          validate?: string | null
        }
        Relationships: []
      }
      memory_snapshots: {
        Row: {
          content: string
          covers_from: string | null
          covers_to: string | null
          created_at: string
          id: string
          snapshot_type: string
          user_id: string
        }
        Insert: {
          content: string
          covers_from?: string | null
          covers_to?: string | null
          created_at?: string
          id?: string
          snapshot_type: string
          user_id: string
        }
        Update: {
          content?: string
          covers_from?: string | null
          covers_to?: string | null
          created_at?: string
          id?: string
          snapshot_type?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          message_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string | null
          id: string
          last_seen_at: string
          preferred_persona: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_seen_at?: string
          preferred_persona?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_at?: string
          preferred_persona?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
