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
      accounts: {
        Row: {
          created_at: string
          currency: string
          current_balance: number
          iban_masked: string | null
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          sync_status: Database["public"]["Enums"]["sync_status"]
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_balance?: number
          iban_masked?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          type?: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_balance?: number
          iban_masked?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          content: string
          generated_at: string
          id: string
          is_dismissed: boolean
          related_entity_id: string | null
          related_entity_type: string | null
          type: Database["public"]["Enums"]["insight_type"]
          user_id: string
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          is_dismissed?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          type: Database["public"]["Enums"]["insight_type"]
          user_id: string
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          is_dismissed?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          type?: Database["public"]["Enums"]["insight_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          period: Database["public"]["Enums"]["budget_period"]
          start_date: string
          user_id: string
          warning_threshold: number
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          user_id: string
          warning_threshold?: number
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          user_id?: string
          warning_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          essential_level: Database["public"]["Enums"]["essential_level"]
          icon: string | null
          id: string
          is_default: boolean
          name: string
          parent_category_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          essential_level?: Database["public"]["Enums"]["essential_level"]
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          parent_category_id?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          essential_level?: Database["public"]["Enums"]["essential_level"]
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          parent_category_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_snapshots: {
        Row: {
          created_at: string
          financial_health_score: number | null
          id: string
          net_savings: number
          savings_rate: number
          snapshot_date: string
          total_expenses: number
          total_income: number
          user_id: string
        }
        Insert: {
          created_at?: string
          financial_health_score?: number | null
          id?: string
          net_savings?: number
          savings_rate?: number
          snapshot_date: string
          total_expenses?: number
          total_income?: number
          user_id: string
        }
        Update: {
          created_at?: string
          financial_health_score?: number | null
          id?: string
          net_savings?: number
          savings_rate?: number
          snapshot_date?: string
          total_expenses?: number
          total_income?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          is_recurring: boolean
          source_type: Database["public"]["Enums"]["income_source_type"]
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          source_type?: Database["public"]["Enums"]["income_source_type"]
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          source_type?: Database["public"]["Enums"]["income_source_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          is_active: boolean
          name: string
          next_due_date: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          is_active?: boolean
          name: string
          next_due_date?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          current_amount: number
          id: string
          monthly_contribution: number | null
          name: string
          target_amount: number
          target_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          id?: string
          monthly_contribution?: number | null
          name: string
          target_amount: number
          target_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          id?: string
          monthly_contribution?: number | null
          name?: string
          target_amount?: number
          target_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          currency_default: string
          id: string
          locale: string
          notification_preferences: Json
          theme: Database["public"]["Enums"]["theme_pref"]
          user_id: string
        }
        Insert: {
          created_at?: string
          currency_default?: string
          id?: string
          locale?: string
          notification_preferences?: Json
          theme?: Database["public"]["Enums"]["theme_pref"]
          user_id: string
        }
        Update: {
          created_at?: string
          currency_default?: string
          id?: string
          locale?: string
          notification_preferences?: Json
          theme?: Database["public"]["Enums"]["theme_pref"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          date: string
          description: string | null
          external_transaction_id: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          recurring_expense_id: string | null
          source: Database["public"]["Enums"]["tx_source"]
          status: Database["public"]["Enums"]["tx_status"]
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          date: string
          description?: string | null
          external_transaction_id?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recurring_expense_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          status?: Database["public"]["Enums"]["tx_status"]
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          external_transaction_id?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recurring_expense_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          status?: Database["public"]["Enums"]["tx_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_profile: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      delete_my_data: { Args: never; Returns: undefined }
      recalc_account_balance: {
        Args: { p_account_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "credit_card"
        | "debit_card"
        | "cash"
        | "investment"
        | "other"
      budget_period: "weekly" | "monthly"
      essential_level: "necessario" | "importante" | "discrezionale" | "altro"
      income_source_type:
        | "salary"
        | "bonus"
        | "overtime"
        | "freelance"
        | "rental"
        | "reimbursement"
        | "other"
      insight_type:
        | "saving_opportunity"
        | "anomaly"
        | "recommendation"
        | "health_score_explanation"
      notification_type:
        | "budget_exceeded"
        | "budget_warning"
        | "recurring_due"
        | "anomaly"
        | "goal_progress"
        | "sync_failed"
        | "consent_expiring"
      payment_method:
        | "card"
        | "bank_transfer"
        | "cash"
        | "direct_debit"
        | "other"
      recurrence_frequency: "weekly" | "monthly" | "yearly"
      sync_status: "active" | "consent_expired" | "disconnected" | "manual"
      theme_pref: "light" | "dark" | "system"
      tx_source: "manual" | "open_banking" | "csv_import"
      tx_status: "pending" | "booked"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: [
        "checking",
        "savings",
        "credit_card",
        "debit_card",
        "cash",
        "investment",
        "other",
      ],
      budget_period: ["weekly", "monthly"],
      essential_level: ["necessario", "importante", "discrezionale", "altro"],
      income_source_type: [
        "salary",
        "bonus",
        "overtime",
        "freelance",
        "rental",
        "reimbursement",
        "other",
      ],
      insight_type: [
        "saving_opportunity",
        "anomaly",
        "recommendation",
        "health_score_explanation",
      ],
      notification_type: [
        "budget_exceeded",
        "budget_warning",
        "recurring_due",
        "anomaly",
        "goal_progress",
        "sync_failed",
        "consent_expiring",
      ],
      payment_method: [
        "card",
        "bank_transfer",
        "cash",
        "direct_debit",
        "other",
      ],
      recurrence_frequency: ["weekly", "monthly", "yearly"],
      sync_status: ["active", "consent_expired", "disconnected", "manual"],
      theme_pref: ["light", "dark", "system"],
      tx_source: ["manual", "open_banking", "csv_import"],
      tx_status: ["pending", "booked"],
    },
  },
} as const
