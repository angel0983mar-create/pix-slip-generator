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
      orders: {
        Row: {
          amount: number
          created_at: string
          customer_contact: string | null
          customer_name: string
          description: string | null
          due_date: string | null
          id: string
          items: Json
          notes: string | null
          order_number: number
          paid_at: string | null
          payment_method: string
          pix_payload: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_contact?: string | null
          customer_name?: string
          description?: string | null
          due_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          payment_method?: string
          pix_payload?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_contact?: string | null
          customer_name?: string
          description?: string | null
          due_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          payment_method?: string
          pix_payload?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          category: string | null
          created_at: string
          id: string
          name: string
          price: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name: string
          price?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_branch: string
          city: string
          created_at: string
          document: string | null
          id: string
          merchant_name: string
          next_order_number: number
          open_order_limit: number
          phone: string | null
          pix_key: string | null
          pix_key_type: string
          plan: string
          print_layout: string
          receipt_footer: string | null
          store_logo_url: string | null
          store_name: string
          updated_at: string
        }
        Insert: {
          business_branch?: string
          city?: string
          created_at?: string
          document?: string | null
          id: string
          merchant_name?: string
          next_order_number?: number
          open_order_limit?: number
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string
          plan?: string
          print_layout?: string
          receipt_footer?: string | null
          store_logo_url?: string | null
          store_name?: string
          updated_at?: string
        }
        Update: {
          business_branch?: string
          city?: string
          created_at?: string
          document?: string | null
          id?: string
          merchant_name?: string
          next_order_number?: number
          open_order_limit?: number
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string
          plan?: string
          print_layout?: string
          receipt_footer?: string | null
          store_logo_url?: string | null
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          label: string | null
          owner_id: string
          revoked: boolean
          role: string
          token: string
          uses: number
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          owner_id: string
          revoked?: boolean
          role?: string
          token?: string
          uses?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          owner_id?: string
          revoked?: boolean
          role?: string
          token?: string
          uses?: number
        }
        Relationships: []
      }
      store_members: {
        Row: {
          created_at: string
          id: string
          member_email: string | null
          member_id: string
          owner_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_id: string
          owner_id: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_id?: string
          owner_id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_store_invite: {
        Args: { _token: string }
        Returns: {
          owner_id: string
          role: string
        }[]
      }
      my_store: {
        Args: never
        Returns: {
          owner_id: string
          role: string
        }[]
      }
      store_invite_info: {
        Args: { _token: string }
        Returns: {
          role: string
          store_name: string
          valid: boolean
        }[]
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
    Enums: {},
  },
} as const
