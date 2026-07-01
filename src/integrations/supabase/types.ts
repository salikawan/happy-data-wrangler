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
      attendance: {
        Row: {
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_selfie_url: string | null
          check_in_time: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_selfie_url: string | null
          check_out_time: string | null
          created_at: string
          date: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_selfie_url?: string | null
          check_in_time?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie_url?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_selfie_url?: string | null
          check_in_time?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie_url?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance_settings: {
        Row: {
          allowed_lat: number | null
          allowed_lng: number | null
          allowed_radius_meters: number
          enable_selfie: boolean
          enforce_geofence: boolean
          id: number
          late_after_time: string
          require_checkin_selfie: boolean
          require_checkout_selfie: boolean
          updated_at: string
        }
        Insert: {
          allowed_lat?: number | null
          allowed_lng?: number | null
          allowed_radius_meters?: number
          enable_selfie?: boolean
          enforce_geofence?: boolean
          id?: number
          late_after_time?: string
          require_checkin_selfie?: boolean
          require_checkout_selfie?: boolean
          updated_at?: string
        }
        Update: {
          allowed_lat?: number | null
          allowed_lng?: number | null
          allowed_radius_meters?: number
          enable_selfie?: boolean
          enforce_geofence?: boolean
          id?: number
          late_after_time?: string
          require_checkin_selfie?: boolean
          require_checkout_selfie?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          grace_minutes: number
          id: number
          logo_url: string | null
          timezone: string
          updated_at: string
          work_end: string
          work_start: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          grace_minutes?: number
          id?: number
          logo_url?: string | null
          timezone?: string
          updated_at?: string
          work_end?: string
          work_start?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          grace_minutes?: number
          id?: number
          logo_url?: string | null
          timezone?: string
          updated_at?: string
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          from_date: string
          id: string
          leave_type: string
          reason: string | null
          status: string
          to_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          status?: string
          to_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          status?: string
          to_date?: string
          user_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          radius_meters: number
        }
        Insert: {
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          channel: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          target_user_id: string | null
          title: string
        }
        Insert: {
          audience?: string
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          target_user_id?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          target_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          basic_salary: number | null
          created_at: string
          department: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          employee_id: string | null
          full_name: string
          id: string
          joining_date: string | null
          location_id: string | null
          phone: string | null
          salary_type: string | null
          shift_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          basic_salary?: number | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string
          id: string
          joining_date?: string | null
          location_id?: string | null
          phone?: string | null
          salary_type?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          basic_salary?: number | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          joining_date?: string | null
          location_id?: string | null
          phone?: string | null
          salary_type?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number
          created_at: string
          end_time: string
          grace_minutes: number
          id: string
          name: string
          off_days: string[]
          ot_eligible: boolean
          start_time: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          end_time: string
          grace_minutes?: number
          id?: string
          name: string
          off_days?: string[]
          ot_eligible?: boolean
          start_time: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          name?: string
          off_days?: string[]
          ot_eligible?: boolean
          start_time?: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
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
      app_role: ["admin", "employee"],
    },
  },
} as const
