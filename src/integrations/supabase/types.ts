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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          ai_default_provider: string
          firebase_config: Json
          firebase_vapid_key: string | null
          gemini_model: string
          github_auto_close: boolean
          github_merged_status: string
          github_repo: string | null
          id: number
          push_enabled: boolean
          slack_notify_assigned: boolean
          slack_notify_created: boolean
          slack_notify_status: boolean
          slack_webhook_url: string | null
          updated_at: string
        }
        Insert: {
          ai_default_provider?: string
          firebase_config?: Json
          firebase_vapid_key?: string | null
          gemini_model?: string
          github_auto_close?: boolean
          github_merged_status?: string
          github_repo?: string | null
          id?: number
          push_enabled?: boolean
          slack_notify_assigned?: boolean
          slack_notify_created?: boolean
          slack_notify_status?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Update: {
          ai_default_provider?: string
          firebase_config?: Json
          firebase_vapid_key?: string | null
          gemini_model?: string
          github_auto_close?: boolean
          github_merged_status?: string
          github_repo?: string | null
          id?: number
          push_enabled?: boolean
          slack_notify_assigned?: boolean
          slack_notify_created?: boolean
          slack_notify_status?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assistance_requests: {
        Row: {
          bug_id: number
          created_at: string
          id: number
          message: string | null
          requester_id: string
          responded_at: string | null
          status: string
          target_user_id: string
          type: string
        }
        Insert: {
          bug_id: number
          created_at?: string
          id?: number
          message?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
          target_user_id: string
          type: string
        }
        Update: {
          bug_id?: number
          created_at?: string
          id?: number
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
          target_user_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_requests_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          bug_id: number
          content: string
          created_at: string
          filename: string | null
          id: number
          type: string
        }
        Insert: {
          bug_id: number
          content: string
          created_at?: string
          filename?: string | null
          id?: number
          type: string
        }
        Update: {
          bug_id?: number
          content?: string
          created_at?: string
          filename?: string | null
          id?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_history: {
        Row: {
          bug_id: number
          created_at: string
          field: string
          id: number
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          bug_id: number
          created_at?: string
          field: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          bug_id?: number
          created_at?: string
          field?: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bug_history_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_relations: {
        Row: {
          created_at: string
          id: number
          related_id: number
          source_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          related_id: number
          source_id: number
        }
        Update: {
          created_at?: string
          id?: number
          related_id?: number
          source_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bug_relations_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bug_relations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_time_entries: {
        Row: {
          bug_id: number
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bug_id: number
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bug_id?: number
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_time_entries_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      bugs: {
        Row: {
          actual_result: string | null
          assigned_to: string | null
          bug_id: string
          created_at: string
          environment: string | null
          expected_result: string | null
          github_ref_number: number | null
          github_ref_type: string | null
          github_repo: string | null
          github_url: string | null
          id: number
          module: string
          notes: string | null
          priority: string
          project_id: number | null
          reported_by: string | null
          retest: string | null
          role: string | null
          severity: string
          status: string
          steps: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          assigned_to?: string | null
          bug_id: string
          created_at?: string
          environment?: string | null
          expected_result?: string | null
          github_ref_number?: number | null
          github_ref_type?: string | null
          github_repo?: string | null
          github_url?: string | null
          id?: number
          module: string
          notes?: string | null
          priority?: string
          project_id?: number | null
          reported_by?: string | null
          retest?: string | null
          role?: string | null
          severity?: string
          status?: string
          steps?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          assigned_to?: string | null
          bug_id?: string
          created_at?: string
          environment?: string | null
          expected_result?: string | null
          github_ref_number?: number | null
          github_ref_type?: string | null
          github_repo?: string | null
          github_url?: string | null
          id?: number
          module?: string
          notes?: string | null
          priority?: string
          project_id?: number | null
          reported_by?: string | null
          retest?: string | null
          role?: string | null
          severity?: string
          status?: string
          steps?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bugs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          bug_id: number
          content: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          bug_id: number
          content: string
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          bug_id?: number
          content?: string
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          bug_id: number | null
          bug_title: string | null
          created_at: string
          id: number
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          bug_id?: number | null
          bug_title?: string | null
          created_at?: string
          id?: number
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          bug_id?: number | null
          bug_title?: string | null
          created_at?: string
          id?: number
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_active: boolean
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          is_active?: boolean
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          username?: string
        }
        Relationships: []
      }
      project_developers: {
        Row: {
          created_at: string
          id: number
          project_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          project_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          project_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_developers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          key: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          key: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          key?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: number
          started_at: string
          task_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: number
          started_at?: string
          task_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: number
          started_at?: string
          task_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          is_important: boolean
          priority: string
          project_id: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          is_important?: boolean
          priority?: string
          project_id?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          is_important?: boolean
          priority?: string
          project_id?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_keys: {
        Row: {
          api_key_ciphertext: string
          created_at: string
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_ciphertext: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_ciphertext?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      resolution_time_analytics: {
        Row: {
          bug_code: string | null
          bug_id: number | null
          developer_id: string | null
          developer_name: string | null
          entries: number | null
          module: string | null
          project_id: number | null
          title: string | null
          total_seconds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bug_time_entries_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bugs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_pending_migrations: { Args: never; Returns: Json }
      bug_dashboard_stats: { Args: { _scope?: string }; Returns: Json }
      bug_exists: { Args: { _bug_id: number }; Returns: boolean }
      can_create_tasks: { Args: { _user_id: string }; Returns: boolean }
      can_manage_bug: {
        Args: { _bug_id: number; _user_id?: string }
        Returns: boolean
      }
      can_manage_project: {
        Args: { _project_id: number; _user_id?: string }
        Returns: boolean
      }
      can_report_bugs: { Args: { _user_id: string }; Returns: boolean }
      get_resolution_time_analytics: {
        Args: never
        Returns: {
          bug_code: string
          bug_id: number
          developer_id: string
          developer_name: string
          entries: number
          module: string
          project_id: number
          title: string
          total_seconds: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_active: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "developer"
        | "tester"
        | "supervisor"
        | "auditor"
        | "monitor"
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
      app_role: [
        "admin",
        "developer",
        "tester",
        "supervisor",
        "auditor",
        "monitor",
      ],
    },
  },
} as const
