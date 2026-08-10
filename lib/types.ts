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
      categoria: {
        Row: {
          color: string | null
          fecha_creacion: string
          icono: string | null
          id_categoria: string
          id_usuario: string
          nombre: string
        }
        Insert: {
          color?: string | null
          fecha_creacion?: string
          icono?: string | null
          id_categoria?: string
          id_usuario: string
          nombre: string
        }
        Update: {
          color?: string | null
          fecha_creacion?: string
          icono?: string | null
          id_categoria?: string
          id_usuario?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      dragon: {
        Row: {
          activo: boolean
          asset_key: string
          credit_cost: number
          descripcion: string | null
          es_inicial: boolean
          id_dragon: string
          id_tema: string | null
          nombre: string
          orden: number | null
          premium_required: boolean
        }
        Insert: {
          activo?: boolean
          asset_key: string
          credit_cost?: number
          descripcion?: string | null
          es_inicial?: boolean
          id_dragon?: string
          id_tema?: string | null
          nombre: string
          orden?: number | null
          premium_required?: boolean
        }
        Update: {
          activo?: boolean
          asset_key?: string
          credit_cost?: number
          descripcion?: string | null
          es_inicial?: boolean
          id_dragon?: string
          id_tema?: string | null
          nombre?: string
          orden?: number | null
          premium_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dragon_id_tema_fkey"
            columns: ["id_tema"]
            isOneToOne: false
            referencedRelation: "tema"
            referencedColumns: ["id_tema"]
          },
        ]
      }
      dragon_regla_desbloqueo: {
        Row: {
          id_dragon: string
          id_regla: string
          percentage_required: number | null
          rule_type: string
          target_value: number | null
        }
        Insert: {
          id_dragon: string
          id_regla?: string
          percentage_required?: number | null
          rule_type: string
          target_value?: number | null
        }
        Update: {
          id_dragon?: string
          id_regla?: string
          percentage_required?: number | null
          rule_type?: string
          target_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dragon_regla_desbloqueo_id_dragon_fkey"
            columns: ["id_dragon"]
            isOneToOne: false
            referencedRelation: "dragon"
            referencedColumns: ["id_dragon"]
          },
        ]
      }
      logro: {
        Row: {
          activo: boolean
          credit_reward: number
          descripcion: string | null
          id_logro: string
          nombre: string
          percentage_required: number | null
          rule_type: string
          target_value: number | null
          xp_reward: number
        }
        Insert: {
          activo?: boolean
          credit_reward?: number
          descripcion?: string | null
          id_logro?: string
          nombre: string
          percentage_required?: number | null
          rule_type: string
          target_value?: number | null
          xp_reward?: number
        }
        Update: {
          activo?: boolean
          credit_reward?: number
          descripcion?: string | null
          id_logro?: string
          nombre?: string
          percentage_required?: number | null
          rule_type?: string
          target_value?: number | null
          xp_reward?: number
        }
        Relationships: []
      }
      movimiento_credito: {
        Row: {
          clave_idempotencia: string | null
          created_at: string
          descripcion: string | null
          id: string
          id_dragon: string | null
          id_objetivo: string | null
          id_tarea: string | null
          id_usuario: string
          monto: number
          tipo: string
        }
        Insert: {
          clave_idempotencia?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          id_dragon?: string | null
          id_objetivo?: string | null
          id_tarea?: string | null
          id_usuario: string
          monto: number
          tipo: string
        }
        Update: {
          clave_idempotencia?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          id_dragon?: string | null
          id_objetivo?: string | null
          id_tarea?: string | null
          id_usuario?: string
          monto?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_credito_id_dragon_fkey"
            columns: ["id_dragon"]
            isOneToOne: false
            referencedRelation: "dragon"
            referencedColumns: ["id_dragon"]
          },
          {
            foreignKeyName: "movimiento_credito_id_objetivo_fkey"
            columns: ["id_objetivo"]
            isOneToOne: false
            referencedRelation: "objetivo"
            referencedColumns: ["id_objetivo"]
          },
          {
            foreignKeyName: "movimiento_credito_id_tarea_fkey"
            columns: ["id_tarea"]
            isOneToOne: false
            referencedRelation: "tarea"
            referencedColumns: ["id_tarea"]
          },
          {
            foreignKeyName: "movimiento_credito_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      movimiento_xp: {
        Row: {
          cantidad: number
          clave_idempotencia: string | null
          fecha_creacion: string
          id: string
          id_objetivo: string | null
          id_tarea: string | null
          id_usuario: string
          motivo: string
        }
        Insert: {
          cantidad: number
          clave_idempotencia?: string | null
          fecha_creacion?: string
          id?: string
          id_objetivo?: string | null
          id_tarea?: string | null
          id_usuario: string
          motivo: string
        }
        Update: {
          cantidad?: number
          clave_idempotencia?: string | null
          fecha_creacion?: string
          id?: string
          id_objetivo?: string | null
          id_tarea?: string | null
          id_usuario?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_xp_id_objetivo_fkey"
            columns: ["id_objetivo"]
            isOneToOne: false
            referencedRelation: "objetivo"
            referencedColumns: ["id_objetivo"]
          },
          {
            foreignKeyName: "movimiento_xp_id_tarea_fkey"
            columns: ["id_tarea"]
            isOneToOne: false
            referencedRelation: "tarea"
            referencedColumns: ["id_tarea"]
          },
          {
            foreignKeyName: "movimiento_xp_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      objetivo: {
        Row: {
          activo: boolean
          descripcion: string | null
          fecha_creacion: string
          fecha_fin: string | null
          fecha_inicio: string
          frecuencia_cantidad: number | null
          frecuencia_tipo: Database["public"]["Enums"]["frecuencia_tipo"]
          fuente_datos: Database["public"]["Enums"]["fuente_datos"]
          hora_recordatorio: string | null
          id_categoria: string | null
          id_objetivo: string
          id_usuario: string
          meta_valor: number | null
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_objetivo"]
          unidad: string | null
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          fecha_creacion?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          frecuencia_cantidad?: number | null
          frecuencia_tipo: Database["public"]["Enums"]["frecuencia_tipo"]
          fuente_datos?: Database["public"]["Enums"]["fuente_datos"]
          hora_recordatorio?: string | null
          id_categoria?: string | null
          id_objetivo?: string
          id_usuario: string
          meta_valor?: number | null
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_objetivo"]
          unidad?: string | null
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          fecha_creacion?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          frecuencia_cantidad?: number | null
          frecuencia_tipo?: Database["public"]["Enums"]["frecuencia_tipo"]
          fuente_datos?: Database["public"]["Enums"]["fuente_datos"]
          hora_recordatorio?: string | null
          id_categoria?: string | null
          id_objetivo?: string
          id_usuario?: string
          meta_valor?: number | null
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_objetivo"]
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objetivo_id_categoria_fkey"
            columns: ["id_categoria"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id_categoria"]
          },
          {
            foreignKeyName: "objetivo_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      objetivo_dia: {
        Row: {
          dia_semana: number
          id_objetivo: string
        }
        Insert: {
          dia_semana: number
          id_objetivo: string
        }
        Update: {
          dia_semana?: number
          id_objetivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "objetivo_dia_id_objetivo_fkey"
            columns: ["id_objetivo"]
            isOneToOne: false
            referencedRelation: "objetivo"
            referencedColumns: ["id_objetivo"]
          },
        ]
      }
      perfil: {
        Row: {
          creditos: number
          fecha_creacion: string
          id_usuario: string
          nivel: number
          nombre: string | null
          xp_total: number
        }
        Insert: {
          creditos?: number
          fecha_creacion?: string
          id_usuario: string
          nivel?: number
          nombre?: string | null
          xp_total?: number
        }
        Update: {
          creditos?: number
          fecha_creacion?: string
          id_usuario?: string
          nivel?: number
          nombre?: string | null
          xp_total?: number
        }
        Relationships: []
      }
      preferencia_usuario: {
        Row: {
          id_dragon_seleccionado: string | null
          id_tema_seleccionado: string | null
          id_usuario: string
        }
        Insert: {
          id_dragon_seleccionado?: string | null
          id_tema_seleccionado?: string | null
          id_usuario: string
        }
        Update: {
          id_dragon_seleccionado?: string | null
          id_tema_seleccionado?: string | null
          id_usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferencia_usuario_id_dragon_seleccionado_fkey"
            columns: ["id_dragon_seleccionado"]
            isOneToOne: false
            referencedRelation: "dragon"
            referencedColumns: ["id_dragon"]
          },
          {
            foreignKeyName: "preferencia_usuario_id_tema_seleccionado_fkey"
            columns: ["id_tema_seleccionado"]
            isOneToOne: false
            referencedRelation: "tema"
            referencedColumns: ["id_tema"]
          },
          {
            foreignKeyName: "preferencia_usuario_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      registro_objetivo: {
        Row: {
          completado: boolean
          fecha: string
          fecha_actualizacion: string
          id_objetivo: string
          id_registro: string
          omitido: boolean
          valor: number | null
        }
        Insert: {
          completado?: boolean
          fecha: string
          fecha_actualizacion?: string
          id_objetivo: string
          id_registro?: string
          omitido?: boolean
          valor?: number | null
        }
        Update: {
          completado?: boolean
          fecha?: string
          fecha_actualizacion?: string
          id_objetivo?: string
          id_registro?: string
          omitido?: boolean
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_objetivo_id_objetivo_fkey"
            columns: ["id_objetivo"]
            isOneToOne: false
            referencedRelation: "objetivo"
            referencedColumns: ["id_objetivo"]
          },
        ]
      }
      suscripcion: {
        Row: {
          created_at: string
          expiration_date: string | null
          id_suscripcion: string
          id_usuario: string
          plan: string
          platform: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          id_suscripcion?: string
          id_usuario: string
          plan?: string
          platform?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          id_suscripcion?: string
          id_usuario?: string
          plan?: string
          platform?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripcion_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      tarea: {
        Row: {
          completada: boolean
          descripcion: string | null
          fecha_completada: string | null
          fecha_creacion: string
          fecha_limite: string | null
          hora_limite: string | null
          id_categoria: string | null
          id_tarea: string
          id_usuario: string
          prioridad: Database["public"]["Enums"]["prioridad_tarea"]
          titulo: string
        }
        Insert: {
          completada?: boolean
          descripcion?: string | null
          fecha_completada?: string | null
          fecha_creacion?: string
          fecha_limite?: string | null
          hora_limite?: string | null
          id_categoria?: string | null
          id_tarea?: string
          id_usuario: string
          prioridad?: Database["public"]["Enums"]["prioridad_tarea"]
          titulo: string
        }
        Update: {
          completada?: boolean
          descripcion?: string | null
          fecha_completada?: string | null
          fecha_creacion?: string
          fecha_limite?: string | null
          hora_limite?: string | null
          id_categoria?: string | null
          id_tarea?: string
          id_usuario?: string
          prioridad?: Database["public"]["Enums"]["prioridad_tarea"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarea_id_categoria_fkey"
            columns: ["id_categoria"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id_categoria"]
          },
          {
            foreignKeyName: "tarea_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      tema: {
        Row: {
          accent_color: string
          background_color: string
          id_tema: string
          nombre: string
          primary_color: string
          secondary_color: string
          success_color: string
          surface_color: string
          text_primary: string
          text_secondary: string
          warning_color: string
        }
        Insert: {
          accent_color: string
          background_color: string
          id_tema?: string
          nombre: string
          primary_color: string
          secondary_color: string
          success_color: string
          surface_color: string
          text_primary: string
          text_secondary: string
          warning_color: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          id_tema?: string
          nombre?: string
          primary_color?: string
          secondary_color?: string
          success_color?: string
          surface_color?: string
          text_primary?: string
          text_secondary?: string
          warning_color?: string
        }
        Relationships: []
      }
      usuario_dragon: {
        Row: {
          credit_price_paid: number | null
          id_dragon: string
          id_usuario: string
          purchased_at: string
        }
        Insert: {
          credit_price_paid?: number | null
          id_dragon: string
          id_usuario: string
          purchased_at?: string
        }
        Update: {
          credit_price_paid?: number | null
          id_dragon?: string
          id_usuario?: string
          purchased_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_dragon_id_dragon_fkey"
            columns: ["id_dragon"]
            isOneToOne: false
            referencedRelation: "dragon"
            referencedColumns: ["id_dragon"]
          },
          {
            foreignKeyName: "usuario_dragon_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      usuario_logro: {
        Row: {
          id_logro: string
          id_usuario: string
          unlocked_at: string
        }
        Insert: {
          id_logro: string
          id_usuario: string
          unlocked_at?: string
        }
        Update: {
          id_logro?: string
          id_usuario?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_logro_id_logro_fkey"
            columns: ["id_logro"]
            isOneToOne: false
            referencedRelation: "logro"
            referencedColumns: ["id_logro"]
          },
          {
            foreignKeyName: "usuario_logro_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      frecuencia_tipo: "DAILY" | "SPECIFIC_DAYS" | "WEEKLY_COUNT"
      fuente_datos: "MANUAL" | "HEALTH_CONNECT"
      prioridad_tarea: "BAJA" | "MEDIA" | "ALTA"
      tipo_objetivo: "BOOLEAN" | "NUMERIC"
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
      frecuencia_tipo: ["DAILY", "SPECIFIC_DAYS", "WEEKLY_COUNT"],
      fuente_datos: ["MANUAL", "HEALTH_CONNECT"],
      prioridad_tarea: ["BAJA", "MEDIA", "ALTA"],
      tipo_objetivo: ["BOOLEAN", "NUMERIC"],
    },
  },
} as const
