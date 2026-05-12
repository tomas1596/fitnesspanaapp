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
      body_measurements: {
        Row: {
          arms: number | null
          chest: number | null
          created_at: string
          id: string
          measurement_date: string
          updated_at: string
          user_id: string
          waist: number | null
          weight: number | null
        }
        Insert: {
          arms?: number | null
          chest?: number | null
          created_at?: string
          id?: string
          measurement_date?: string
          updated_at?: string
          user_id: string
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arms?: number | null
          chest?: number | null
          created_at?: string
          id?: string
          measurement_date?: string
          updated_at?: string
          user_id?: string
          waist?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      custom_foods: {
        Row: {
          base_calories: number
          base_carbs: number
          base_fat: number
          base_protein: number
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          base_calories?: number
          base_carbs?: number
          base_fat?: number
          base_protein?: number
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          base_calories?: number
          base_carbs?: number
          base_fat?: number
          base_protein?: number
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          avg_heart_rate: number | null
          avg_pace_seconds_per_km: number
          cadence: number | null
          calories: number | null
          created_at: string
          distance_meters: number
          duration_seconds: number
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          id: string
          route_data: Json
          splits: Json
          steps: number | null
          started_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          avg_heart_rate?: number | null
          avg_pace_seconds_per_km?: number
          cadence?: number | null
          calories?: number | null
          created_at?: string
          distance_meters?: number
          duration_seconds?: number
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          id?: string
          route_data?: Json
          splits?: Json
          steps?: number | null
          started_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          avg_heart_rate?: number | null
          avg_pace_seconds_per_km?: number
          cadence?: number | null
          calories?: number | null
          created_at?: string
          distance_meters?: number
          duration_seconds?: number
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          id?: string
          route_data?: Json
          splits?: Json
          steps?: number | null
          started_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exercise_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          reps: number
          rir: number | null
          set_number: number
          to_failure: boolean | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          reps?: number
          rir?: number | null
          set_number?: number
          to_failure?: boolean | null
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          reps?: number
          rir?: number | null
          set_number?: number
          to_failure?: boolean | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          id: string
          muscle_group: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workout_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_group: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workout_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          muscle_group?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workout_date?: string
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          entry_date: string
          fat: number
          id: string
          meal: string
          name: string
          protein: number
          quantity: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          entry_date?: string
          fat?: number
          id?: string
          meal?: string
          name: string
          protein?: number
          quantity?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          entry_date?: string
          fat?: number
          id?: string
          meal?: string
          name?: string
          protein?: number
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
      hydration_logs: {
        Row: {
          created_at: string
          glasses: number
          id: string
          log_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          glasses?: number
          id?: string
          log_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          glasses?: number
          id?: string
          log_date?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number
          carbs: number
          consumed_at: string
          fat: number
          food_name: string
          id: string
          meal_type: string
          protein: number
          quantity_multiplier: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          consumed_at?: string
          fat?: number
          food_name: string
          id?: string
          meal_type: string
          protein?: number
          quantity_multiplier?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          consumed_at?: string
          fat?: number
          food_name?: string
          id?: string
          meal_type?: string
          protein?: number
          quantity_multiplier?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          fitness_goal: string | null
          gender: string | null
          height: number | null
          id: string
          is_admin: boolean
          last_name: string | null
          step_goal: number
          target_weight: number | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          activity_level?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          is_admin?: boolean
          last_name?: string | null
          step_goal?: number
          target_weight?: number | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          activity_level?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          is_admin?: boolean
          last_name?: string | null
          step_goal?: number
          target_weight?: number | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string
          id: string
          pose: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pose: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pose?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      recovery_logs: {
        Row: {
          created_at: string
          energy_level: number
          id: string
          log_date: string
          sleep_quality: number
          user_id: string
        }
        Insert: {
          created_at?: string
          energy_level?: number
          id?: string
          log_date?: string
          sleep_quality?: number
          user_id: string
        }
        Update: {
          created_at?: string
          energy_level?: number
          id?: string
          log_date?: string
          sleep_quality?: number
          user_id?: string
        }
        Relationships: []
      }
      step_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          steps: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          steps?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          steps?: number
          user_id?: string
        }
        Relationships: []
      }
      template_exercises: {
        Row: {
          created_at: string
          id: string
          muscle_group: string
          name: string
          position: number
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_group: string
          name: string
          position?: number
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muscle_group?: string
          name?: string
          position?: number
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
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
