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
      app_settings: {
        Row: {
          falai_balance_usd: number
          geracao_price_usd: number
          id: boolean
          image_base_price_usd: number
          image_price_usd: number
          openai_balance_usd: number
          render_price_usd: number
          updated_at: string
          usd_brl_rate: number
        }
        Insert: {
          falai_balance_usd?: number
          geracao_price_usd?: number
          id?: boolean
          image_base_price_usd?: number
          image_price_usd?: number
          openai_balance_usd?: number
          render_price_usd?: number
          updated_at?: string
          usd_brl_rate?: number
        }
        Update: {
          falai_balance_usd?: number
          geracao_price_usd?: number
          id?: boolean
          image_base_price_usd?: number
          image_price_usd?: number
          openai_balance_usd?: number
          render_price_usd?: number
          updated_at?: string
          usd_brl_rate?: number
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          accent_color: string | null
          assinatura: string | null
          brand_voice: string | null
          company_name: string
          created_at: string
          font_pair: string | null
          id: string
          instagram_url: string | null
          logo_has_name: boolean | null
          logo_position: string
          logo_url: string | null
          main_activity: string | null
          primary_color: string | null
          secondary_color: string | null
          secondary_font: string | null
          segment: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          assinatura?: string | null
          brand_voice?: string | null
          company_name: string
          created_at?: string
          font_pair?: string | null
          id?: string
          instagram_url?: string | null
          logo_has_name?: boolean | null
          logo_position?: string
          logo_url?: string | null
          main_activity?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          secondary_font?: string | null
          segment?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          assinatura?: string | null
          brand_voice?: string | null
          company_name?: string
          created_at?: string
          font_pair?: string | null
          id?: string
          instagram_url?: string | null
          logo_has_name?: boolean | null
          logo_position?: string
          logo_url?: string | null
          main_activity?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          secondary_font?: string | null
          segment?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invited_emails: {
        Row: {
          accepted_at: string | null
          bonus_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          kit_migrated_at: string | null
          nome: string | null
          plano_id: string | null
          plano1_id: string | null
          plano2_id: string | null
          source_test_profile_id: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          bonus_id?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          kit_migrated_at?: string | null
          nome?: string | null
          plano_id?: string | null
          plano1_id?: string | null
          plano2_id?: string | null
          source_test_profile_id?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          bonus_id?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          kit_migrated_at?: string | null
          nome?: string | null
          plano_id?: string | null
          plano1_id?: string | null
          plano2_id?: string | null
          source_test_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invited_emails_bonus_id_fkey"
            columns: ["bonus_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invited_emails_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invited_emails_plano1_id_fkey"
            columns: ["plano1_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invited_emails_plano2_id_fkey"
            columns: ["plano2_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ativo: boolean
          base_carrossel: number
          base_estatico: number
          base_estatico_final: number
          base_reels: number
          codigo: string
          created_at: string
          custo_total_usd: number
          elegivel_bonus: boolean
          id: string
          limite_geracoes: number
          limite_geracoes_display: number | null
          limite_imagens: number
          limite_imgs_display: number | null
          limite_renders: number
          limite_renders_display: number | null
          nome: string
          preco_maximo_brl: number
          tipo: string
          updated_at: string
          valor_plano: number
        }
        Insert: {
          ativo?: boolean
          base_carrossel?: number
          base_estatico?: number
          base_estatico_final?: number
          base_reels?: number
          codigo: string
          created_at?: string
          custo_total_usd?: number
          elegivel_bonus?: boolean
          id?: string
          limite_geracoes?: number
          limite_geracoes_display?: number | null
          limite_imagens?: number
          limite_imgs_display?: number | null
          limite_renders?: number
          limite_renders_display?: number | null
          nome: string
          preco_maximo_brl?: number
          tipo: string
          updated_at?: string
          valor_plano?: number
        }
        Update: {
          ativo?: boolean
          base_carrossel?: number
          base_estatico?: number
          base_estatico_final?: number
          base_reels?: number
          codigo?: string
          created_at?: string
          custo_total_usd?: number
          elegivel_bonus?: boolean
          id?: string
          limite_geracoes?: number
          limite_geracoes_display?: number | null
          limite_imagens?: number
          limite_imgs_display?: number | null
          limite_renders?: number
          limite_renders_display?: number | null
          nome?: string
          preco_maximo_brl?: number
          tipo?: string
          updated_at?: string
          valor_plano?: number
        }
        Relationships: []
      }
      plan_purchases: {
        Row: {
          assigned_by: string | null
          closed_by: string | null
          created_at: string
          expira_em: string | null
          geracoes_limite: number
          geracoes_usados_final: number
          id: string
          imgs_limite: number
          imgs_usadas_final: number
          inicio: string | null
          motivo_fechamento: string | null
          plan_codigo: string | null
          plan_id: string | null
          plan_nome: string | null
          preco_brl: number | null
          renders_limite: number
          renders_usados_final: number
          slot: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          closed_by?: string | null
          created_at?: string
          expira_em?: string | null
          geracoes_limite?: number
          geracoes_usados_final?: number
          id?: string
          imgs_limite?: number
          imgs_usadas_final?: number
          inicio?: string | null
          motivo_fechamento?: string | null
          plan_codigo?: string | null
          plan_id?: string | null
          plan_nome?: string | null
          preco_brl?: number | null
          renders_limite?: number
          renders_usados_final?: number
          slot: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          closed_by?: string | null
          created_at?: string
          expira_em?: string | null
          geracoes_limite?: number
          geracoes_usados_final?: number
          id?: string
          imgs_limite?: number
          imgs_usadas_final?: number
          inicio?: string | null
          motivo_fechamento?: string | null
          plan_codigo?: string | null
          plan_id?: string | null
          plan_nome?: string | null
          preco_brl?: number | null
          renders_limite?: number
          renders_usados_final?: number
          slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bonus_assigned_by: string | null
          bonus_expira_em: string | null
          bonus_geracoes_limite: number
          bonus_geracoes_usadas: number
          bonus_id: string | null
          bonus_imgs_limite: number
          bonus_imgs_usadas: number
          bonus_inicio: string | null
          bonus_last_charged_at: string | null
          bonus_renders_limite: number
          bonus_renders_usados: number
          client_code: string
          created_by: string | null
          client_seq: number
          client_seq_segmento: number | null
          created_at: string
          email: string
          extra_b_carrossel: number
          extra_b_estatico: number
          extra_b_estatico_final: number
          extra_b_reels: number
          extra_p1_carrossel: number
          extra_p1_estatico: number
          extra_p1_estatico_final: number
          extra_p1_reels: number
          extra_p2_carrossel: number
          extra_p2_estatico: number
          extra_p2_estatico_final: number
          extra_p2_reels: number
          id: string
          imagens_limite: number
          imagens_usadas: number
          is_test: boolean
          nome: string | null
          plano_id: string | null
          plano1_expira_em: string | null
          plano1_geracoes_limite: number
          plano1_geracoes_usadas: number
          plano1_id: string | null
          plano1_imgs_limite: number
          plano1_imgs_usadas: number
          plano1_inicio: string | null
          plano1_last_charged_at: string | null
          plano1_renders_limite: number
          plano1_renders_usados: number
          plano2_expira_em: string | null
          plano2_geracoes_limite: number
          plano2_geracoes_usadas: number
          plano2_id: string | null
          plano2_imgs_limite: number
          plano2_imgs_usadas: number
          plano2_inicio: string | null
          plano2_last_charged_at: string | null
          plano2_renders_limite: number
          plano2_renders_usados: number
          renders_limite: number
          renders_usados: number
          segmento: string | null
          status: string
          ultimo_login: string | null
          updated_at: string
        }
        Insert: {
          bonus_assigned_by?: string | null
          bonus_expira_em?: string | null
          bonus_geracoes_limite?: number
          bonus_geracoes_usadas?: number
          bonus_id?: string | null
          bonus_imgs_limite?: number
          bonus_imgs_usadas?: number
          bonus_inicio?: string | null
          bonus_last_charged_at?: string | null
          bonus_renders_limite?: number
          bonus_renders_usados?: number
          client_code: string
          client_seq: number
          client_seq_segmento?: number | null
          created_at?: string
          created_by?: string | null
          email: string
          extra_b_carrossel?: number
          extra_b_estatico?: number
          extra_b_estatico_final?: number
          extra_b_reels?: number
          extra_p1_carrossel?: number
          extra_p1_estatico?: number
          extra_p1_estatico_final?: number
          extra_p1_reels?: number
          extra_p2_carrossel?: number
          extra_p2_estatico?: number
          extra_p2_estatico_final?: number
          extra_p2_reels?: number
          id: string
          imagens_limite?: number
          imagens_usadas?: number
          is_test?: boolean
          nome?: string | null
          plano_id?: string | null
          plano1_expira_em?: string | null
          plano1_geracoes_limite?: number
          plano1_geracoes_usadas?: number
          plano1_id?: string | null
          plano1_imgs_limite?: number
          plano1_imgs_usadas?: number
          plano1_inicio?: string | null
          plano1_last_charged_at?: string | null
          plano1_renders_limite?: number
          plano1_renders_usados?: number
          plano2_expira_em?: string | null
          plano2_geracoes_limite?: number
          plano2_geracoes_usadas?: number
          plano2_id?: string | null
          plano2_imgs_limite?: number
          plano2_imgs_usadas?: number
          plano2_inicio?: string | null
          plano2_last_charged_at?: string | null
          plano2_renders_limite?: number
          plano2_renders_usados?: number
          renders_limite?: number
          renders_usados?: number
          segmento?: string | null
          status?: string
          ultimo_login?: string | null
          updated_at?: string
        }
        Update: {
          bonus_assigned_by?: string | null
          bonus_expira_em?: string | null
          bonus_geracoes_limite?: number
          bonus_geracoes_usadas?: number
          bonus_id?: string | null
          bonus_imgs_limite?: number
          bonus_imgs_usadas?: number
          bonus_inicio?: string | null
          bonus_last_charged_at?: string | null
          bonus_renders_limite?: number
          bonus_renders_usados?: number
          client_code?: string
          created_by?: string | null
          client_seq?: number
          client_seq_segmento?: number | null
          created_at?: string
          email?: string
          extra_b_carrossel?: number
          extra_b_estatico?: number
          extra_b_estatico_final?: number
          extra_b_reels?: number
          extra_p1_carrossel?: number
          extra_p1_estatico?: number
          extra_p1_estatico_final?: number
          extra_p1_reels?: number
          extra_p2_carrossel?: number
          extra_p2_estatico?: number
          extra_p2_estatico_final?: number
          extra_p2_reels?: number
          id?: string
          imagens_limite?: number
          imagens_usadas?: number
          is_test?: boolean
          nome?: string | null
          plano_id?: string | null
          plano1_expira_em?: string | null
          plano1_geracoes_limite?: number
          plano1_geracoes_usadas?: number
          plano1_id?: string | null
          plano1_imgs_limite?: number
          plano1_imgs_usadas?: number
          plano1_inicio?: string | null
          plano1_last_charged_at?: string | null
          plano1_renders_limite?: number
          plano1_renders_usados?: number
          plano2_expira_em?: string | null
          plano2_geracoes_limite?: number
          plano2_geracoes_usadas?: number
          plano2_id?: string | null
          plano2_imgs_limite?: number
          plano2_imgs_usadas?: number
          plano2_inicio?: string | null
          plano2_last_charged_at?: string | null
          plano2_renders_limite?: number
          plano2_renders_usados?: number
          renders_limite?: number
          renders_usados?: number
          segmento?: string | null
          status?: string
          ultimo_login?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bonus_id_fkey"
            columns: ["bonus_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plano1_id_fkey"
            columns: ["plano1_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plano2_id_fkey"
            columns: ["plano2_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          created_at: string
          custo_usd: number
          evento: string
          id: string
          modulo: string | null
          payload: Json | null
          qtd_geracoes: number
          qtd_imagens: number
          qtd_renders: number
          slot: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo_usd?: number
          evento: string
          id?: string
          modulo?: string | null
          payload?: Json | null
          qtd_geracoes?: number
          qtd_imagens?: number
          qtd_renders?: number
          slot?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo_usd?: number
          evento?: string
          id?: string
          modulo?: string | null
          payload?: Json | null
          qtd_geracoes?: number
          qtd_imagens?: number
          qtd_renders?: number
          slot?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_assets: {
        Row: {
          bytes: number
          created_at: string
          generation_id: string
          id: string
          ordem: number
          storage_path: string
          user_id: string
        }
        Insert: {
          bytes?: number
          created_at?: string
          generation_id: string
          id?: string
          ordem?: number
          storage_path: string
          user_id: string
        }
        Update: {
          bytes?: number
          created_at?: string
          generation_id?: string
          id?: string
          ordem?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assets_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "user_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_generations: {
        Row: {
          created_at: string
          dia: number | null
          expires_at: string
          formato: string
          id: string
          legenda: string
          pdf_path: string | null
          slot: string
          tipo: string
          titulo: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          dia?: number | null
          expires_at?: string
          formato: string
          id?: string
          legenda?: string
          pdf_path?: string | null
          slot: string
          tipo: string
          titulo?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          dia?: number | null
          expires_at?: string
          formato?: string
          id?: string
          legenda?: string
          pdf_path?: string | null
          slot?: string
          tipo?: string
          titulo?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
      user_image_kits: {
        Row: {
          avatar_path: string | null
          avatar_path_2: string | null
          cenario_tipos: string[]
          cenarios_paths: string[]
          created_at: string
          produtos_paths: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          avatar_path_2?: string | null
          cenario_tipos?: string[]
          cenarios_paths?: string[]
          created_at?: string
          produtos_paths?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          avatar_path_2?: string | null
          cenario_tipos?: string[]
          cenarios_paths?: string[]
          created_at?: string
          produtos_paths?: string[]
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
      user_sequences: {
        Row: {
          created_at: string
          download_url: string | null
          id: string
          json_conteudo: Json | null
          nome_sequencia: string
          tipo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          id?: string
          json_conteudo?: Json | null
          nome_sequencia: string
          tipo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          id?: string
          json_conteudo?: Json | null
          nome_sequencia?: string
          tipo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      voice_clones: {
        Row: {
          created_at: string
          duration_s: number
          external_voice_id: string
          id: string
          last_used_at: string | null
          provider: string
          sample_path: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_s?: number
          external_voice_id: string
          id?: string
          last_used_at?: string | null
          provider?: string
          sample_path: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_s?: number
          external_voice_id?: string
          id?: string
          last_used_at?: string | null
          provider?: string
          sample_path?: string
          status?: string
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
      _rand_alnum: { Args: { _n: number }; Returns: string }
      admin_storage_stats: { Args: Record<PropertyKey, never>; Returns: Json }
      _rand_letters: { Args: { _n: number }; Returns: string }
      _seg_code: { Args: { _seg: string }; Returns: string }
      calc_cost:
        | { Args: { _imgs: number; _renders: number }; Returns: number }
        | {
            Args: { _geracoes?: number; _imgs: number; _renders: number }
            Returns: number
          }
      debit_personalizado: {
        Args: { _tipo: string; _user_id: string }
        Returns: string
      }
      debit_usage: {
        Args: {
          _geracoes?: number
          _imgs: number
          _renders: number
          _user_id: string
        }
        Returns: string
      }
      gen_client_code:
        | { Args: { _segmento: string }; Returns: string }
        | { Args: { _segmento: string; _seq: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_expired_generations: {
        Args: never
        Returns: {
          id: string
          user_id: string
        }[]
      }
      list_generations_to_evict: {
        Args: {
          _formato: string
          _slot: string
          _tipo: string
          _user_id: string
        }
        Returns: string[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
