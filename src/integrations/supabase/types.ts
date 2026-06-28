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
      angles: {
        Row: {
          brief_id: string
          created_at: string
          description: string | null
          entry_point: Database["public"]["Enums"]["angle_entry_point"] | null
          id: string
          status: string | null
          target_segment: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_id: string
          created_at?: string
          description?: string | null
          entry_point?: Database["public"]["Enums"]["angle_entry_point"] | null
          id?: string
          status?: string | null
          target_segment?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_id?: string
          created_at?: string
          description?: string | null
          entry_point?: Database["public"]["Enums"]["angle_entry_point"] | null
          id?: string
          status?: string | null
          target_segment?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "angles_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          notes: string | null
          prompt_used: string | null
          shot_id: string
          status: Database["public"]["Enums"]["asset_status"]
          tool_used: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          prompt_used?: string | null
          shot_id: string
          status?: Database["public"]["Enums"]["asset_status"]
          tool_used?: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          prompt_used?: string | null
          shot_id?: string
          status?: Database["public"]["Enums"]["asset_status"]
          tool_used?: string | null
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          avoid_competitors: string | null
          brand_voice: string | null
          category: string | null
          created_at: string
          fonts: string | null
          id: string
          name: string
          no_go_list: string | null
          notes: string | null
          one_line_what_you_sell: string | null
          personality: Json | null
          primary_color: string | null
          secondary_color: string | null
          tone_do: string | null
          tone_dont: string | null
          updated_at: string
          user_id: string
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          avoid_competitors?: string | null
          brand_voice?: string | null
          category?: string | null
          created_at?: string
          fonts?: string | null
          id?: string
          name: string
          no_go_list?: string | null
          notes?: string | null
          one_line_what_you_sell?: string | null
          personality?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          tone_do?: string | null
          tone_dont?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          avoid_competitors?: string | null
          brand_voice?: string | null
          category?: string | null
          created_at?: string
          fonts?: string | null
          id?: string
          name?: string
          no_go_list?: string | null
          notes?: string | null
          one_line_what_you_sell?: string | null
          personality?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          tone_do?: string | null
          tone_dont?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: []
      }
      briefs: {
        Row: {
          ai_disclosure: boolean | null
          archetypes: Json | null
          audience_age: string | null
          audience_gender: string | null
          audience_income: string | null
          audience_location: string | null
          awards: string | null
          awareness_stage: string | null
          benchmark: string | null
          benefits: Json | null
          brand_id: string
          budget_tier: string | null
          cannot_claim: string | null
          captions_required: boolean | null
          claims_substantiated: boolean | null
          core_driver: string | null
          created_at: string
          customer_language: string | null
          deadline: string | null
          destination_url: string | null
          disclosures: string | null
          headspace: string | null
          id: string
          kpi_target: string | null
          kpi_type: string | null
          languages: string | null
          legal_copy: string | null
          likeness_notes: string | null
          must_include: string | null
          notes: string | null
          objection: string | null
          objective: Database["public"]["Enums"]["brief_objective"] | null
          offer_detail: string | null
          offer_type: string | null
          placements: Json | null
          price: number | null
          product_description: string | null
          product_name: string | null
          project_name: string
          psychographic: string | null
          reference_links: string | null
          regulated: boolean | null
          signoff_owner: string | null
          stats_claims: string | null
          status: Database["public"]["Enums"]["brief_status"]
          testimonials: string | null
          updated_at: string
          user_id: string
          variants_needed: number | null
          wedge: string | null
        }
        Insert: {
          ai_disclosure?: boolean | null
          archetypes?: Json | null
          audience_age?: string | null
          audience_gender?: string | null
          audience_income?: string | null
          audience_location?: string | null
          awards?: string | null
          awareness_stage?: string | null
          benchmark?: string | null
          benefits?: Json | null
          brand_id: string
          budget_tier?: string | null
          cannot_claim?: string | null
          captions_required?: boolean | null
          claims_substantiated?: boolean | null
          core_driver?: string | null
          created_at?: string
          customer_language?: string | null
          deadline?: string | null
          destination_url?: string | null
          disclosures?: string | null
          headspace?: string | null
          id?: string
          kpi_target?: string | null
          kpi_type?: string | null
          languages?: string | null
          legal_copy?: string | null
          likeness_notes?: string | null
          must_include?: string | null
          notes?: string | null
          objection?: string | null
          objective?: Database["public"]["Enums"]["brief_objective"] | null
          offer_detail?: string | null
          offer_type?: string | null
          placements?: Json | null
          price?: number | null
          product_description?: string | null
          product_name?: string | null
          project_name: string
          psychographic?: string | null
          reference_links?: string | null
          regulated?: boolean | null
          signoff_owner?: string | null
          stats_claims?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          testimonials?: string | null
          updated_at?: string
          user_id: string
          variants_needed?: number | null
          wedge?: string | null
        }
        Update: {
          ai_disclosure?: boolean | null
          archetypes?: Json | null
          audience_age?: string | null
          audience_gender?: string | null
          audience_income?: string | null
          audience_location?: string | null
          awards?: string | null
          awareness_stage?: string | null
          benchmark?: string | null
          benefits?: Json | null
          brand_id?: string
          budget_tier?: string | null
          cannot_claim?: string | null
          captions_required?: boolean | null
          claims_substantiated?: boolean | null
          core_driver?: string | null
          created_at?: string
          customer_language?: string | null
          deadline?: string | null
          destination_url?: string | null
          disclosures?: string | null
          headspace?: string | null
          id?: string
          kpi_target?: string | null
          kpi_type?: string | null
          languages?: string | null
          legal_copy?: string | null
          likeness_notes?: string | null
          must_include?: string | null
          notes?: string | null
          objection?: string | null
          objective?: Database["public"]["Enums"]["brief_objective"] | null
          offer_detail?: string | null
          offer_type?: string | null
          placements?: Json | null
          price?: number | null
          product_description?: string | null
          product_name?: string | null
          project_name?: string
          psychographic?: string | null
          reference_links?: string | null
          regulated?: boolean | null
          signoff_owner?: string | null
          stats_claims?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          testimonials?: string | null
          updated_at?: string
          user_id?: string
          variants_needed?: number | null
          wedge?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brief_id: string
          created_at: string
          id: string
          meta_campaign_name: string | null
          naming_convention: string | null
          objective: string | null
          status: string | null
          structure_type: string | null
          test_matrix: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_id: string
          created_at?: string
          id?: string
          meta_campaign_name?: string | null
          naming_convention?: string | null
          objective?: string | null
          status?: string | null
          structure_type?: string | null
          test_matrix?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_id?: string
          created_at?: string
          id?: string
          meta_campaign_name?: string | null
          naming_convention?: string | null
          objective?: string | null
          status?: string | null
          structure_type?: string | null
          test_matrix?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      cuts: {
        Row: {
          brief_id: string
          created_at: string
          edit_notes: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          brief_id: string
          created_at?: string
          edit_notes?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          brief_id?: string
          created_at?: string
          edit_notes?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cuts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["deliverable_aspect"] | null
          captions_burned: boolean | null
          created_at: string
          cut_id: string
          duration_seconds: number | null
          file_url: string | null
          id: string
          placement: Database["public"]["Enums"]["deliverable_placement"] | null
          spec_checked: boolean | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?:
            | Database["public"]["Enums"]["deliverable_aspect"]
            | null
          captions_burned?: boolean | null
          created_at?: string
          cut_id: string
          duration_seconds?: number | null
          file_url?: string | null
          id?: string
          placement?:
            | Database["public"]["Enums"]["deliverable_placement"]
            | null
          spec_checked?: boolean | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?:
            | Database["public"]["Enums"]["deliverable_aspect"]
            | null
          captions_burned?: boolean | null
          created_at?: string
          cut_id?: string
          duration_seconds?: number | null
          file_url?: string | null
          id?: string
          placement?:
            | Database["public"]["Enums"]["deliverable_placement"]
            | null
          spec_checked?: boolean | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_cut_id_fkey"
            columns: ["cut_id"]
            isOneToOne: false
            referencedRelation: "cuts"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          cpa: number | null
          created_at: string
          ctr: number | null
          date: string
          deliverable_id: string
          hold_rate: number | null
          hook_rate: number | null
          id: string
          impressions: number | null
          notes: string | null
          roas: number | null
          spend: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          deliverable_id: string
          hold_rate?: number | null
          hook_rate?: number | null
          id?: string
          impressions?: number | null
          notes?: string | null
          roas?: number | null
          spend?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          deliverable_id?: string
          hold_rate?: number | null
          hook_rate?: number | null
          id?: string
          impressions?: number | null
          notes?: string | null
          roas?: number | null
          spend?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_library: {
        Row: {
          archetype: string | null
          created_at: string
          id: string
          notes: string | null
          performance_tag: string | null
          prompt_text: string | null
          title: string
          tool: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performance_tag?: string | null
          prompt_text?: string | null
          title: string
          tool?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performance_tag?: string | null
          prompt_text?: string | null
          title?: string
          tool?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_reviews: {
        Row: {
          brand_ok: boolean | null
          brief_id: string
          captions_ok: boolean | null
          claims_ok: boolean | null
          created_at: string
          disclosures_ok: boolean | null
          id: string
          policy_ok: boolean | null
          reviewer: string | null
          safe_zones_ok: boolean | null
          signed_off: boolean | null
          specs_ok: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_ok?: boolean | null
          brief_id: string
          captions_ok?: boolean | null
          claims_ok?: boolean | null
          created_at?: string
          disclosures_ok?: boolean | null
          id?: string
          policy_ok?: boolean | null
          reviewer?: string | null
          safe_zones_ok?: boolean | null
          signed_off?: boolean | null
          specs_ok?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_ok?: boolean | null
          brief_id?: string
          captions_ok?: boolean | null
          claims_ok?: boolean | null
          created_at?: string
          disclosures_ok?: boolean | null
          id?: string
          policy_ok?: boolean | null
          reviewer?: string | null
          safe_zones_ok?: boolean | null
          signed_off?: boolean | null
          specs_ok?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_reviews_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          angle_id: string
          archetype: string | null
          body: string | null
          created_at: string
          cta: string | null
          duration_seconds: number | null
          full_script: string | null
          hook: string | null
          id: string
          proof_beat: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          angle_id: string
          archetype?: string | null
          body?: string | null
          created_at?: string
          cta?: string | null
          duration_seconds?: number | null
          full_script?: string | null
          hook?: string | null
          id?: string
          proof_beat?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          angle_id?: string
          archetype?: string | null
          body?: string | null
          created_at?: string
          cta?: string | null
          duration_seconds?: number | null
          full_script?: string | null
          hook?: string | null
          id?: string
          proof_beat?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_angle_id_fkey"
            columns: ["angle_id"]
            isOneToOne: false
            referencedRelation: "angles"
            referencedColumns: ["id"]
          },
        ]
      }
      shots: {
        Row: {
          assigned_tool: string | null
          audio_note: string | null
          camera_move: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          motion_intensity: string | null
          reference_notes: string | null
          script_id: string
          shot_number: number | null
          updated_at: string
          user_id: string
          visual_description: string | null
        }
        Insert: {
          assigned_tool?: string | null
          audio_note?: string | null
          camera_move?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          motion_intensity?: string | null
          reference_notes?: string | null
          script_id: string
          shot_number?: number | null
          updated_at?: string
          user_id: string
          visual_description?: string | null
        }
        Update: {
          assigned_tool?: string | null
          audio_note?: string | null
          camera_move?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          motion_intensity?: string | null
          reference_notes?: string | null
          script_id?: string
          shot_number?: number | null
          updated_at?: string
          user_id?: string
          visual_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shots_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
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
      angle_entry_point:
        | "pain"
        | "outcome"
        | "objection"
        | "social_proof"
        | "identity"
        | "curiosity"
      asset_status: "queued" | "generating" | "review" | "approved" | "rejected"
      asset_type: "clip" | "voiceover" | "music" | "sfx"
      brief_objective:
        | "awareness"
        | "traffic"
        | "engagement"
        | "leads"
        | "sales"
      brief_status: "draft" | "locked" | "in_production" | "live" | "archived"
      deliverable_aspect: "9:16" | "4:5" | "1:1"
      deliverable_placement: "reels" | "feed" | "stories"
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
      angle_entry_point: [
        "pain",
        "outcome",
        "objection",
        "social_proof",
        "identity",
        "curiosity",
      ],
      asset_status: ["queued", "generating", "review", "approved", "rejected"],
      asset_type: ["clip", "voiceover", "music", "sfx"],
      brief_objective: ["awareness", "traffic", "engagement", "leads", "sales"],
      brief_status: ["draft", "locked", "in_production", "live", "archived"],
      deliverable_aspect: ["9:16", "4:5", "1:1"],
      deliverable_placement: ["reels", "feed", "stories"],
    },
  },
} as const
