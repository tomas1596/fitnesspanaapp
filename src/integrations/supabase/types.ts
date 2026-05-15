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
      exercises_library: {
        Row: {
          category: string
          created_at: string
          id: string
          modalities: string[]
          muscle_group: string
          name: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          modalities?: string[]
          muscle_group: string
          name: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          modalities?: string[]
          muscle_group?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
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
          portion_unit?: string
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
          rounds: number | null
          set_number: number
          time_seconds: number | null
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
          rounds?: number | null
          set_number?: number
          time_seconds?: number | null
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
          rounds?: number | null
          set_number?: number
          time_seconds?: number | null
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
          conditioning_block_id: string | null
          created_at: string
          id: string
          modality: string
          muscle_group: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workout_date: string
          workout_log_id: string | null
        }
        Insert: {
          conditioning_block_id?: string | null
          created_at?: string
          id?: string
          modality?: string
          muscle_group: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workout_date?: string
          workout_log_id?: string | null
        }
        Update: {
          conditioning_block_id?: string | null
          created_at?: string
          id?: string
          modality?: string
          muscle_group?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workout_date?: string
          workout_log_id?: string | null
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
      gym_routines: {
        Row: {
          id: string
          coach_id: string
          modality: string
          day_number: number
          title: string
          workout_data: Json
          coach_notes: string
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          modality: string
          day_number: number
          title?: string
          workout_data?: Json
          coach_notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          modality?: string
          day_number?: number
          title?: string
          workout_data?: Json
          coach_notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gym_routines_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
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
      personal_records: {
        Row: {
          date: string
          exercise_name: string
          id: string
          user_id: string
          weight: number
        }
        Insert: {
          date?: string
          exercise_name: string
          id?: string
          user_id: string
          weight: number
        }
        Update: {
          date?: string
          exercise_name?: string
          id?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          avatar_url: string | null
          coach_code: string | null
          coach_id: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          fitness_goal: string | null
          gender: string | null
          gym_name: string | null
          gym_modalities: string[]
          height: number | null
          id: string
          is_admin: boolean
          is_coach: boolean
          last_active_at: string | null
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
          coach_code?: string | null
          coach_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          gender?: string | null
          gym_name?: string | null
          gym_modalities?: string[]
          height?: number | null
          id?: string
          is_admin?: boolean
          is_coach?: boolean
          last_active_at?: string | null
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
          coach_code?: string | null
          coach_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          gender?: string | null
          gym_name?: string | null
          gym_modalities?: string[]
          height?: number | null
          id?: string
          is_admin?: boolean
          is_coach?: boolean
          last_active_at?: string | null
          last_name?: string | null
          step_goal?: number
          target_weight?: number | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      weight_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          log_date: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          user_id?: string
          weight?: number
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
      workout_logs: {
        Row: {
          id: string
          user_id: string
          workout_date: string
          modality: string
          total_time: string | null
          target_time: string | null
          wod_title: string | null
          movements: Json
          block_sections: Json
          split_times: Json
          round_count: number | null
          circuit_name: string | null
          work_rest_note: string | null
          crossfit_details: Json
          functional_details: Json
          gym_routine_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_date: string
          modality: string
          total_time?: string | null
          target_time?: string | null
          wod_title?: string | null
          movements?: Json
          block_sections?: Json
          split_times?: Json
          round_count?: number | null
          circuit_name?: string | null
          work_rest_note?: string | null
          crossfit_details?: Json
          functional_details?: Json
          gym_routine_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_date?: string
          modality?: string
          total_time?: string | null
          target_time?: string | null
          wod_title?: string | null
          movements?: Json
          block_sections?: Json
          split_times?: Json
          round_count?: number | null
          circuit_name?: string | null
          work_rest_note?: string | null
          crossfit_details?: Json
          functional_details?: Json
          gym_routine_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workout_templates: {
        Row: {
          coach_notes: string | null
          created_at: string
          id: string
          name: string
          routine_category: string
          structured_payload: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_notes?: string | null
          created_at?: string
          id?: string
          name: string
          routine_category?: string
          structured_payload?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_notes?: string | null
          created_at?: string
          id?: string
          name?: string
          routine_category?: string
          structured_payload?: Json | null
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
      admin_set_coach_profile: {
        Args: {
          p_target_user_id: string
          p_is_coach: boolean
          p_gym_name?: string | null
          p_gym_modalities?: string[] | null
        }
        Returns: {
          coach_code: string | null
          gym_name: string | null
          is_coach: boolean
          gym_modalities: string[]
        }[]
      }
      admin_user_directory: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          registered_at: string
          subscription_role: string | null
          subscription_expires_at: string | null
          premium_until: string | null
          is_admin: boolean
          notified_tester: boolean
          notified_premium: boolean
          theme: string
          last_active_at: string | null
          is_coach: boolean
          coach_code: string | null
          gym_name: string | null
          gym_modalities: string[]
        }[]
      }
      coach_remove_student: {
        Args: {
          p_student_id: string
        }
        Returns: null
      }
      get_linked_coach_gym: {
        Args: Record<PropertyKey, never>
        Returns: {
          gym_name: string | null
          gym_modalities: string[] | null
        }[]
      }
      get_coach_students: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          full_name: string | null
          email: string
          avatar_url: string | null
          last_active_at: string | null
        }[]
      }
      get_gym_routine_leaderboard: {
        Args: {
          p_gym_routine_id: string
          p_workout_date: string
        }
        Returns: {
          user_id: string
          display_name: string
          avatar_url: string | null
          total_time: string | null
          round_count: number | null
          work_rest_note: string | null
          modality: string
        }[]
      }
      link_student_to_coach: {
        Args: {
          p_code: string
        }
        Returns: {
          gym_name: string
        }[]
      }
      unlink_student_from_coach: {
        Args: Record<PropertyKey, never>
        Returns: null
      }
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
