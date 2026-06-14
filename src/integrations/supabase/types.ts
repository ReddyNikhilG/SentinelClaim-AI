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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_documents: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_events: {
        Row: {
          claim_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          performed_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_notes: {
        Row: {
          claim_id: string
          content: string
          created_at: string
          id: string
          note_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_id: string
          content: string
          created_at?: string
          id?: string
          note_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_id?: string
          content?: string
          created_at?: string
          id?: string
          note_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          assigned_group: string | null
          assigned_to: string | null
          claim_amount: number
          claim_number: string
          claim_type: Database["public"]["Enums"]["claim_type"]
          claimant_email: string | null
          claimant_name: string
          claimant_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          incident_date: string
          incident_location: string
          policy_number: string
          risk_category: Database["public"]["Enums"]["risk_category"] | null
          risk_score: number | null
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
        }
        Insert: {
          assigned_group?: string | null
          assigned_to?: string | null
          claim_amount: number
          claim_number?: string
          claim_type: Database["public"]["Enums"]["claim_type"]
          claimant_email?: string | null
          claimant_name: string
          claimant_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incident_date: string
          incident_location: string
          policy_number: string
          risk_category?: Database["public"]["Enums"]["risk_category"] | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Update: {
          assigned_group?: string | null
          assigned_to?: string | null
          claim_amount?: number
          claim_number?: string
          claim_type?: Database["public"]["Enums"]["claim_type"]
          claimant_email?: string | null
          claimant_name?: string
          claimant_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incident_date?: string
          incident_location?: string
          policy_number?: string
          risk_category?: Database["public"]["Enums"]["risk_category"] | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fraud_results: {
        Row: {
          analyzed_at: string
          category: Database["public"]["Enums"]["risk_category"]
          claim_id: string
          factors: Json | null
          id: string
          score: number
        }
        Insert: {
          analyzed_at?: string
          category: Database["public"]["Enums"]["risk_category"]
          claim_id: string
          factors?: Json | null
          id?: string
          score: number
        }
        Update: {
          analyzed_at?: string
          category?: Database["public"]["Enums"]["risk_category"]
          claim_id?: string
          factors?: Json | null
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "fraud_results_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_bulk_approved: boolean
          email_bulk_reassign: boolean
          email_bulk_rejected: boolean
          email_bulk_siu_investigation: boolean
          email_claim_reassignment: boolean
          email_digest_enabled: boolean
          email_digest_frequency: string
          email_high_risk_alert: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_bulk_approved?: boolean
          email_bulk_reassign?: boolean
          email_bulk_rejected?: boolean
          email_bulk_siu_investigation?: boolean
          email_claim_reassignment?: boolean
          email_digest_enabled?: boolean
          email_digest_frequency?: string
          email_high_risk_alert?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_bulk_approved?: boolean
          email_bulk_reassign?: boolean
          email_bulk_rejected?: boolean
          email_bulk_siu_investigation?: boolean
          email_claim_reassignment?: boolean
          email_digest_enabled?: boolean
          email_digest_frequency?: string
          email_high_risk_alert?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          claim_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          claim_id?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          claim_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_default_preferences: {
        Row: {
          created_at: string
          email_bulk_approved: boolean
          email_bulk_reassign: boolean
          email_bulk_rejected: boolean
          email_bulk_siu_investigation: boolean
          email_claim_reassignment: boolean
          email_digest_enabled: boolean
          email_digest_frequency: string
          email_high_risk_alert: boolean
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_bulk_approved?: boolean
          email_bulk_reassign?: boolean
          email_bulk_rejected?: boolean
          email_bulk_siu_investigation?: boolean
          email_claim_reassignment?: boolean
          email_digest_enabled?: boolean
          email_digest_frequency?: string
          email_high_risk_alert?: boolean
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_bulk_approved?: boolean
          email_bulk_reassign?: boolean
          email_bulk_rejected?: boolean
          email_bulk_siu_investigation?: boolean
          email_claim_reassignment?: boolean
          email_digest_enabled?: boolean
          email_digest_frequency?: string
          email_high_risk_alert?: boolean
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sla_snapshots: {
        Row: {
          avg_attempts: number
          created_at: string
          failed_count: number
          first_attempt_rate: number
          id: string
          sent_count: number
          sla_healthy: boolean
          success_rate: number
          total_emails: number
          week_start: string
        }
        Insert: {
          avg_attempts?: number
          created_at?: string
          failed_count?: number
          first_attempt_rate?: number
          id?: string
          sent_count?: number
          sla_healthy?: boolean
          success_rate?: number
          total_emails?: number
          week_start: string
        }
        Update: {
          avg_attempts?: number
          created_at?: string
          failed_count?: number
          first_attempt_rate?: number
          id?: string
          sent_count?: number
          sla_healthy?: boolean
          success_rate?: number
          total_emails?: number
          week_start?: string
        }
        Relationships: []
      }
      sla_thresholds: {
        Row: {
          escalation_consecutive_weeks: number
          failure_alert_min_samples: number
          first_attempt_rate_target: number
          id: string
          max_hourly_failure_rate: number
          slack_channel: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          escalation_consecutive_weeks?: number
          failure_alert_min_samples?: number
          first_attempt_rate_target?: number
          id?: string
          max_hourly_failure_rate?: number
          slack_channel?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          escalation_consecutive_weeks?: number
          failure_alert_min_samples?: number
          first_attempt_rate_target?: number
          id?: string
          max_hourly_failure_rate?: number
          slack_channel?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          title: string
        }[]
      }
    }
    Enums: {
      claim_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "siu_investigation"
        | "auto_approved"
      claim_type: "auto" | "property" | "liability" | "workers_comp" | "health"
      risk_category: "low" | "medium" | "high"
      user_role: "admin" | "adjuster" | "siu_analyst"
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
    Enums: {
      claim_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "siu_investigation",
        "auto_approved",
      ],
      claim_type: ["auto", "property", "liability", "workers_comp", "health"],
      risk_category: ["low", "medium", "high"],
      user_role: ["admin", "adjuster", "siu_analyst"],
    },
  },
} as const
