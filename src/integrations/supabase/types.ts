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
      avatar_items: {
        Row: {
          accent_hsl: string
          created_at: string
          emoji: string
          id: string
          name: string
          rarity: string
          slug: string
          theme: string
        }
        Insert: {
          accent_hsl?: string
          created_at?: string
          emoji: string
          id?: string
          name: string
          rarity: string
          slug: string
          theme: string
        }
        Update: {
          accent_hsl?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          rarity?: string
          slug?: string
          theme?: string
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          banned_at: string
          banned_by: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_invites: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          token: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          token?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_invites_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          joined_at: string
          last_read_at: string
          role: Database["public"]["Enums"]["chat_member_role"]
          user_id: string
        }
        Insert: {
          chat_id: string
          joined_at?: string
          last_read_at?: string
          role?: Database["public"]["Enums"]["chat_member_role"]
          user_id: string
        }
        Update: {
          chat_id?: string
          joined_at?: string
          last_read_at?: string
          role?: Database["public"]["Enums"]["chat_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string | null
          type: Database["public"]["Enums"]["chat_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
        }
        Relationships: []
      }
      daily_claims: {
        Row: {
          last_claim_date: string
          user_id: string
        }
        Insert: {
          last_claim_date: string
          user_id: string
        }
        Update: {
          last_claim_date?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          awarded: boolean
          chat_id: string
          created_at: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["game_kind"]
          started_by: string
          winner_id: string | null
        }
        Insert: {
          awarded?: boolean
          chat_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["game_kind"]
          started_by: string
          winner_id?: string | null
        }
        Update: {
          awarded?: boolean
          chat_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["game_kind"]
          started_by?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string | null
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_packs: {
        Row: {
          accent_hsl: string
          created_at: string
          emoji: string
          id: string
          name: string
          price: number
          rarity: string
          slug: string
          theme: string
        }
        Insert: {
          accent_hsl: string
          created_at?: string
          emoji: string
          id?: string
          name: string
          price?: number
          rarity: string
          slug: string
          theme: string
        }
        Update: {
          accent_hsl?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          price?: number
          rarity?: string
          slug?: string
          theme?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          equipped_avatar_id: string | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          equipped_avatar_id?: string | null
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          equipped_avatar_id?: string | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_equipped_avatar_id_fkey"
            columns: ["equipped_avatar_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_offers: {
        Row: {
          chat_id: string
          created_at: string
          from_user: string
          id: string
          offered_avatar_id: string | null
          offered_credits: number
          requested_avatar_id: string | null
          requested_credits: number
          status: string
          to_user: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          from_user: string
          id?: string
          offered_avatar_id?: string | null
          offered_credits?: number
          requested_avatar_id?: string | null
          requested_credits?: number
          status?: string
          to_user: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          from_user?: string
          id?: string
          offered_avatar_id?: string | null
          offered_credits?: number
          requested_avatar_id?: string | null
          requested_credits?: number
          status?: string
          to_user?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_offers_offered_avatar_id_fkey"
            columns: ["offered_avatar_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_requested_avatar_id_fkey"
            columns: ["requested_avatar_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          chat_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_avatars: {
        Row: {
          acquired_at: string
          avatar_item_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          acquired_at?: string
          avatar_item_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          acquired_at?: string
          avatar_item_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatars_avatar_item_id_fkey"
            columns: ["avatar_item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_packs: {
        Row: {
          acquired_at: string
          pack_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          pack_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "profile_packs"
            referencedColumns: ["id"]
          },
        ]
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
      accept_trade_offer: { Args: { _id: string }; Returns: undefined }
      add_member_by_username: {
        Args: { _chat_id: string; _username: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { _reason: string; _target: string }
        Returns: undefined
      }
      admin_delete_user_data: { Args: { _target: string }; Returns: undefined }
      admin_grant_credits: {
        Args: { _amount: number; _target: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          balance: number
          banned: boolean
          id: string
          roles: string[]
          username: string
        }[]
      }
      admin_remove_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_unban_user: { Args: { _target: string }; Returns: undefined }
      award_game_credits: {
        Args: { _session_id: string; _winner_id: string }
        Returns: undefined
      }
      cancel_trade_offer: { Args: { _id: string }; Returns: undefined }
      claim_daily_credits: { Args: never; Returns: number }
      create_group_chat: { Args: { _name: string }; Returns: string }
      create_or_get_dm: { Args: { _other_user: string }; Returns: string }
      create_trade_offer: {
        Args: {
          _chat_id: string
          _offered_avatar: string
          _offered_credits: number
          _requested_avatar: string
          _requested_credits: number
          _to_user: string
        }
        Returns: string
      }
      decline_trade_offer: { Args: { _id: string }; Returns: undefined }
      equip_avatar: { Args: { _avatar_item_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      is_chat_admin: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      join_chat_with_invite: { Args: { _token: string }; Returns: string }
      open_pack: {
        Args: { _pack_id: string }
        Returns: {
          accent_hsl: string
          avatar_item_id: string
          emoji: string
          is_new: boolean
          name: string
          rarity: string
        }[]
      }
      purchase_pack: { Args: { _pack_id: string }; Returns: undefined }
      respond_friend_request: {
        Args: { _accept: boolean; _id: string }
        Returns: undefined
      }
      sell_avatar: { Args: { _avatar_item_id: string }; Returns: number }
      send_friend_request: { Args: { _username: string }; Returns: string }
      unequip_avatar: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner"
      chat_member_role: "admin" | "member"
      chat_type: "dm" | "group"
      friend_status: "pending" | "accepted"
      game_kind: "parkour" | "skribble"
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
      app_role: ["admin", "moderator", "user", "owner"],
      chat_member_role: ["admin", "member"],
      chat_type: ["dm", "group"],
      friend_status: ["pending", "accepted"],
      game_kind: ["parkour", "skribble"],
    },
  },
} as const
