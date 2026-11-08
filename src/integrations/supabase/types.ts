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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      arvores: {
        Row: {
          altura: number | null
          autex: string
          cap: number | null
          categoria: string | null
          created_at: string
          dap: number | null
          empresa_id: string | null
          id: string
          nome_cientifico: string | null
          nome_vulgar: string
          numero: number
          picada: string | null
          volume: number | null
        }
        Insert: {
          altura?: number | null
          autex?: string
          cap?: number | null
          categoria?: string | null
          created_at?: string
          dap?: number | null
          empresa_id?: string | null
          id?: string
          nome_cientifico?: string | null
          nome_vulgar?: string
          numero: number
          picada?: string | null
          volume?: number | null
        }
        Update: {
          altura?: number | null
          autex?: string
          cap?: number | null
          categoria?: string | null
          created_at?: string
          dap?: number | null
          empresa_id?: string | null
          id?: string
          nome_cientifico?: string | null
          nome_vulgar?: string
          numero?: number
          picada?: string | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arvores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      autex: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          encerrado: boolean
          numero: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          encerrado?: boolean
          numero: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          encerrado?: boolean
          numero?: string
        }
        Relationships: [
          {
            foreignKeyName: "autex_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_usuarios: {
        Row: {
          created_at: string
          empresa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      itens_pacote_serrado: {
        Row: {
          distribuicao_pecas: Json
          empresa_id: string
          especie: string
          grossura: number
          id: string
          largura: number
          pacote_id: string
          tipo_peca: string
          total_pecas: number
          volume_m3: number
        }
        Insert: {
          distribuicao_pecas?: Json
          empresa_id?: string
          especie: string
          grossura: number
          id?: string
          largura: number
          pacote_id: string
          tipo_peca: string
          total_pecas?: number
          volume_m3?: number
        }
        Update: {
          distribuicao_pecas?: Json
          empresa_id?: string
          especie?: string
          grossura?: number
          id?: string
          largura?: number
          pacote_id?: string
          tipo_peca?: string
          total_pecas?: number
          volume_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_pacote_serrado_pacote_id_empresa_id_fkey"
            columns: ["pacote_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "pacotes_serrados"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      motoristas: {
        Row: {
          cpf: string | null
          created_at: string
          empresa_id: string
          nome: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          empresa_id?: string
          nome: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          empresa_id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_serrados: {
        Row: {
          autex: string
          created_at: string
          data: string
          empresa_id: string
          id: string
          numero: string
          observacoes: string
        }
        Insert: {
          autex?: string
          created_at?: string
          data?: string
          empresa_id?: string
          id?: string
          numero: string
          observacoes?: string
        }
        Update: {
          autex?: string
          created_at?: string
          data?: string
          empresa_id?: string
          id?: string
          numero?: string
          observacoes?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_serrados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      patios: {
        Row: {
          created_at: string
          empresa_id: string
          nome: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          nome: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "patios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      registros: {
        Row: {
          acao: string
          criado_em: string
          detalhe: string | null
          empresa_id: string | null
          id: string
          lat: number | null
          lng: number | null
          mudancas: Json | null
          numero: number
          operacao_id: string | null
          reversao_de: string | null
          revertido_em: string | null
          revertido_por: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          detalhe?: string | null
          empresa_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          mudancas?: Json | null
          numero?: number
          operacao_id?: string | null
          reversao_de?: string | null
          revertido_em?: string | null
          revertido_por?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          detalhe?: string | null
          empresa_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          mudancas?: Json | null
          numero?: number
          operacao_id?: string | null
          reversao_de?: string | null
          revertido_em?: string | null
          revertido_por?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneio_carga_pacotes: {
        Row: {
          empresa_id: string
          pacote_id: string
          romaneio_id: string
        }
        Insert: {
          empresa_id?: string
          pacote_id: string
          romaneio_id: string
        }
        Update: {
          empresa_id?: string
          pacote_id?: string
          romaneio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "romaneio_carga_pacotes_pacote_id_empresa_id_fkey"
            columns: ["pacote_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "pacotes_serrados"
            referencedColumns: ["id", "empresa_id"]
          },
          {
            foreignKeyName: "romaneio_carga_pacotes_romaneio_id_empresa_id_fkey"
            columns: ["romaneio_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "romaneios_madeira_serrada"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      romaneios: {
        Row: {
          cpf: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string | null
          id: string
          julieta: string | null
          motorista: string | null
          patio: string | null
          placa: string | null
          qtd_toras: number
          recebido_em: string | null
          total_volume: number
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          julieta?: string | null
          motorista?: string | null
          patio?: string | null
          placa?: string | null
          qtd_toras?: number
          recebido_em?: string | null
          total_volume?: number
        }
        Update: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          julieta?: string | null
          motorista?: string | null
          patio?: string | null
          placa?: string | null
          qtd_toras?: number
          recebido_em?: string | null
          total_volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneios_madeira_serrada: {
        Row: {
          cliente_documento: string
          cliente_nome: string
          created_at: string
          data: string
          empresa_id: string
          id: string
          motorista_cpf: string
          motorista_nome: string
          numero_carga: string
          placa_reboque: string
          placa_veiculo: string
          total_pecas: number
          total_volume_m3: number
        }
        Insert: {
          cliente_documento?: string
          cliente_nome: string
          created_at?: string
          data?: string
          empresa_id?: string
          id?: string
          motorista_cpf?: string
          motorista_nome: string
          numero_carga: string
          placa_reboque?: string
          placa_veiculo: string
          total_pecas?: number
          total_volume_m3?: number
        }
        Update: {
          cliente_documento?: string
          cliente_nome?: string
          created_at?: string
          data?: string
          empresa_id?: string
          id?: string
          motorista_cpf?: string
          motorista_nome?: string
          numero_carga?: string
          placa_reboque?: string
          placa_veiculo?: string
          total_pecas?: number
          total_volume_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_madeira_serrada_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos: {
        Row: {
          atualizado_em: string
          empresa_id: string
          linhas: Json
        }
        Insert: {
          atualizado_em?: string
          empresa_id?: string
          linhas?: Json
        }
        Update: {
          atualizado_em?: string
          empresa_id?: string
          linhas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "saldos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      toras: {
        Row: {
          arvore: number
          autex: string | null
          carregada: boolean
          comprimento: number | null
          created_at: string
          d_pe1: number | null
          d_pe2: number | null
          d_topo1: number | null
          d_topo2: number | null
          empresa_id: string
          especie: string | null
          etiqueta_impressa_em: string | null
          nome_cientifico: string | null
          origem: string | null
          plaqueta: number
          romaneio_id: string | null
          secao: string | null
          serrada_em: string | null
          volume: number
        }
        Insert: {
          arvore: number
          autex?: string | null
          carregada?: boolean
          comprimento?: number | null
          created_at?: string
          d_pe1?: number | null
          d_pe2?: number | null
          d_topo1?: number | null
          d_topo2?: number | null
          empresa_id?: string
          especie?: string | null
          etiqueta_impressa_em?: string | null
          nome_cientifico?: string | null
          origem?: string | null
          plaqueta: number
          romaneio_id?: string | null
          secao?: string | null
          serrada_em?: string | null
          volume?: number
        }
        Update: {
          arvore?: number
          autex?: string | null
          carregada?: boolean
          comprimento?: number | null
          created_at?: string
          d_pe1?: number | null
          d_pe2?: number | null
          d_topo1?: number | null
          d_topo2?: number | null
          empresa_id?: string
          especie?: string | null
          etiqueta_impressa_em?: string | null
          nome_cientifico?: string | null
          origem?: string | null
          plaqueta?: number
          romaneio_id?: string | null
          secao?: string | null
          serrada_em?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "toras_autex_fkey"
            columns: ["empresa_id", "autex"]
            isOneToOne: false
            referencedRelation: "autex"
            referencedColumns: ["empresa_id", "numero"]
          },
          {
            foreignKeyName: "toras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toras_romaneio_id_fkey"
            columns: ["romaneio_id"]
            isOneToOne: false
            referencedRelation: "romaneios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          created_at: string
          empresa_id: string
          placa: string
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          placa: string
          tipo: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          placa?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_minha_empresa: { Args: never; Returns: string }
      excluir_pacote_serrado: {
        Args: { _empresa: string; _id: string; _log: Json }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      minha_empresa: { Args: never; Returns: string }
      origem_tora_legada: { Args: { d: Json }; Returns: string }
      registrar_operacao: {
        Args: {
          _alvos: Json
          _dados: Json
          _empresa: string
          _log: Json
          _operacao: string
          _tipo: string
        }
        Returns: string
      }
      reverter_registro: {
        Args: { _log: Json; _registro: string }
        Returns: string
      }
      salvar_carga_serrada: {
        Args: {
          _cab: Json
          _empresa: string
          _id: string
          _log: Json
          _pacotes: string[]
        }
        Returns: string
      }
      salvar_pacote_serrado: {
        Args: {
          _cab: Json
          _empresa: string
          _id: string
          _itens: Json
          _log: Json
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "superadmin"
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
      app_role: ["admin", "user", "superadmin"],
    },
  },
} as const
