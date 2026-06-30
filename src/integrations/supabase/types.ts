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
      ai_usage: {
        Row: {
          actual_cost: number | null
          created_at: string
          id: string
          input_tokens: number | null
          meta: Json | null
          model: string | null
          output_tokens: number | null
          provider: string
          task: string | null
          user_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          meta?: Json | null
          model?: string | null
          output_tokens?: number | null
          provider: string
          task?: string | null
          user_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          meta?: Json | null
          model?: string | null
          output_tokens?: number | null
          provider?: string
          task?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      angles: {
        Row: {
          brief_id: string
          created_at: string
          description: string | null
          entry_point: Database["public"]["Enums"]["angle_entry_point"] | null
          hook_seed: string | null
          id: string
          priority: number
          status: Database["public"]["Enums"]["angle_status"]
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
          hook_seed?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["angle_status"]
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
          hook_seed?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["angle_status"]
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
          ab_group_id: string | null
          actual_cost: number | null
          audio_used: string | null
          brief_id: string | null
          cost_estimate: number | null
          cost_source: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          file_url: string | null
          frame_id: string | null
          generation_method: string | null
          id: string
          is_selected: boolean
          job_id: string | null
          model_id: string | null
          negative_used: string | null
          notes: string | null
          prompt_used: string | null
          reference_image_url: string | null
          render_tier: Database["public"]["Enums"]["render_tier"]
          seed_used: number | null
          shot_id: string | null
          source_text: string | null
          status: Database["public"]["Enums"]["asset_status"]
          tool_used: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          usage_meta: Json | null
          user_id: string
          variant_label: string | null
          version: number | null
          voice_id: string | null
        }
        Insert: {
          ab_group_id?: string | null
          actual_cost?: number | null
          audio_used?: string | null
          brief_id?: string | null
          cost_estimate?: number | null
          cost_source?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          file_url?: string | null
          frame_id?: string | null
          generation_method?: string | null
          id?: string
          is_selected?: boolean
          job_id?: string | null
          model_id?: string | null
          negative_used?: string | null
          notes?: string | null
          prompt_used?: string | null
          reference_image_url?: string | null
          render_tier?: Database["public"]["Enums"]["render_tier"]
          seed_used?: number | null
          shot_id?: string | null
          source_text?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tool_used?: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          usage_meta?: Json | null
          user_id: string
          variant_label?: string | null
          version?: number | null
          voice_id?: string | null
        }
        Update: {
          ab_group_id?: string | null
          actual_cost?: number | null
          audio_used?: string | null
          brief_id?: string | null
          cost_estimate?: number | null
          cost_source?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          file_url?: string | null
          frame_id?: string | null
          generation_method?: string | null
          id?: string
          is_selected?: boolean
          job_id?: string | null
          model_id?: string | null
          negative_used?: string | null
          notes?: string | null
          prompt_used?: string | null
          reference_image_url?: string | null
          render_tier?: Database["public"]["Enums"]["render_tier"]
          seed_used?: number | null
          shot_id?: string | null
          source_text?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tool_used?: string | null
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          usage_meta?: Json | null
          user_id?: string
          variant_label?: string | null
          version?: number | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
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
          brand_asset_urls: Json
          brand_voice: string | null
          category: string | null
          created_at: string
          fonts: string | null
          id: string
          logo_url: string | null
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
          brand_asset_urls?: Json
          brand_voice?: string | null
          category?: string | null
          created_at?: string
          fonts?: string | null
          id?: string
          logo_url?: string | null
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
          brand_asset_urls?: Json
          brand_voice?: string | null
          category?: string | null
          created_at?: string
          fonts?: string | null
          id?: string
          logo_url?: string | null
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
          product_asset_urls: Json
          product_description: string | null
          product_name: string | null
          project_name: string
          psychographic: string | null
          reference_links: string | null
          regulated: boolean | null
          regulatory_notes: string | null
          signoff_owner: string | null
          spend_cap: number | null
          stats_claims: string | null
          status: Database["public"]["Enums"]["brief_status"]
          testimonials: string | null
          ugc_asset_urls: Json
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
          product_asset_urls?: Json
          product_description?: string | null
          product_name?: string | null
          project_name: string
          psychographic?: string | null
          reference_links?: string | null
          regulated?: boolean | null
          regulatory_notes?: string | null
          signoff_owner?: string | null
          spend_cap?: number | null
          stats_claims?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          testimonials?: string | null
          ugc_asset_urls?: Json
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
          product_asset_urls?: Json
          product_description?: string | null
          product_name?: string | null
          project_name?: string
          psychographic?: string | null
          reference_links?: string | null
          regulated?: boolean | null
          regulatory_notes?: string | null
          signoff_owner?: string | null
          spend_cap?: number | null
          stats_claims?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          testimonials?: string | null
          ugc_asset_urls?: Json
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
          campaign_type: Database["public"]["Enums"]["campaign_type"] | null
          created_at: string
          daily_budget: number | null
          id: string
          meta_campaign_name: string | null
          naming_convention: string | null
          notes: string | null
          objective: string | null
          primary_metric: string | null
          start_date: string | null
          status: string | null
          structure_type: string | null
          test_matrix: Json | null
          updated_at: string
          user_id: string
          utm_template: string | null
        }
        Insert: {
          brief_id: string
          campaign_type?: Database["public"]["Enums"]["campaign_type"] | null
          created_at?: string
          daily_budget?: number | null
          id?: string
          meta_campaign_name?: string | null
          naming_convention?: string | null
          notes?: string | null
          objective?: string | null
          primary_metric?: string | null
          start_date?: string | null
          status?: string | null
          structure_type?: string | null
          test_matrix?: Json | null
          updated_at?: string
          user_id: string
          utm_template?: string | null
        }
        Update: {
          brief_id?: string
          campaign_type?: Database["public"]["Enums"]["campaign_type"] | null
          created_at?: string
          daily_budget?: number | null
          id?: string
          meta_campaign_name?: string | null
          naming_convention?: string | null
          notes?: string | null
          objective?: string | null
          primary_metric?: string | null
          start_date?: string | null
          status?: string | null
          structure_type?: string | null
          test_matrix?: Json | null
          updated_at?: string
          user_id?: string
          utm_template?: string | null
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
      credit_ledger: {
        Row: {
          amount: number
          brand_id: string | null
          brief_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["display_currency"]
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["ledger_entity_type"]
          fx_rate: number
          id: string
          markup: number
          model_id: string | null
          note: string | null
          operation: string | null
          status: Database["public"]["Enums"]["ledger_status"]
          type: Database["public"]["Enums"]["ledger_type"]
          usd_cost: number | null
          user_id: string
        }
        Insert: {
          amount: number
          brand_id?: string | null
          brief_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: Database["public"]["Enums"]["display_currency"]
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["ledger_entity_type"]
          fx_rate: number
          id?: string
          markup?: number
          model_id?: string | null
          note?: string | null
          operation?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
          type: Database["public"]["Enums"]["ledger_type"]
          usd_cost?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          brand_id?: string | null
          brief_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["display_currency"]
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["ledger_entity_type"]
          fx_rate?: number
          id?: string
          markup?: number
          model_id?: string | null
          note?: string | null
          operation?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
          type?: Database["public"]["Enums"]["ledger_type"]
          usd_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      cut_shots: {
        Row: {
          asset_id: string | null
          created_at: string
          cut_id: string
          id: string
          sequence_order: number
          shot_id: string | null
          transition_note: string | null
          trim_note: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          cut_id: string
          id?: string
          sequence_order?: number
          shot_id?: string | null
          transition_note?: string | null
          trim_note?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          cut_id?: string
          id?: string
          sequence_order?: number
          shot_id?: string | null
          transition_note?: string | null
          trim_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cut_shots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_shots_cut_id_fkey"
            columns: ["cut_id"]
            isOneToOne: false
            referencedRelation: "cuts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_shots_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      cuts: {
        Row: {
          brand_frames_ok: boolean
          brief_id: string
          captions_added: boolean
          color_consistent: boolean
          created_at: string
          cta_added: boolean
          edit_notes: string | null
          export_ready: boolean
          hook_timing_ok: boolean
          id: string
          music_asset_url: string | null
          name: string
          script_id: string | null
          status: string | null
          total_duration: number | null
          updated_at: string
          user_id: string
          version: number | null
          vo_asset_url: string | null
        }
        Insert: {
          brand_frames_ok?: boolean
          brief_id: string
          captions_added?: boolean
          color_consistent?: boolean
          created_at?: string
          cta_added?: boolean
          edit_notes?: string | null
          export_ready?: boolean
          hook_timing_ok?: boolean
          id?: string
          music_asset_url?: string | null
          name: string
          script_id?: string | null
          status?: string | null
          total_duration?: number | null
          updated_at?: string
          user_id: string
          version?: number | null
          vo_asset_url?: string | null
        }
        Update: {
          brand_frames_ok?: boolean
          brief_id?: string
          captions_added?: boolean
          color_consistent?: boolean
          created_at?: string
          cta_added?: boolean
          edit_notes?: string | null
          export_ready?: boolean
          hook_timing_ok?: boolean
          id?: string
          music_asset_url?: string | null
          name?: string
          script_id?: string | null
          status?: string | null
          total_duration?: number | null
          updated_at?: string
          user_id?: string
          version?: number | null
          vo_asset_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuts_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["deliverable_aspect"] | null
          audio_ok: boolean
          captions_burned: boolean | null
          created_at: string
          cut_id: string
          duration_ok: boolean
          duration_seconds: number | null
          file_url: string | null
          filename: string | null
          id: string
          notes: string | null
          placement: Database["public"]["Enums"]["deliverable_placement"] | null
          resolution: string | null
          resolution_ok: boolean
          safe_zone_ok: boolean
          spec_checked: boolean | null
          status: string | null
          updated_at: string
          upload_ready: boolean
          user_id: string
        }
        Insert: {
          aspect_ratio?:
            | Database["public"]["Enums"]["deliverable_aspect"]
            | null
          audio_ok?: boolean
          captions_burned?: boolean | null
          created_at?: string
          cut_id: string
          duration_ok?: boolean
          duration_seconds?: number | null
          file_url?: string | null
          filename?: string | null
          id?: string
          notes?: string | null
          placement?:
            | Database["public"]["Enums"]["deliverable_placement"]
            | null
          resolution?: string | null
          resolution_ok?: boolean
          safe_zone_ok?: boolean
          spec_checked?: boolean | null
          status?: string | null
          updated_at?: string
          upload_ready?: boolean
          user_id: string
        }
        Update: {
          aspect_ratio?:
            | Database["public"]["Enums"]["deliverable_aspect"]
            | null
          audio_ok?: boolean
          captions_burned?: boolean | null
          created_at?: string
          cut_id?: string
          duration_ok?: boolean
          duration_seconds?: number | null
          file_url?: string | null
          filename?: string | null
          id?: string
          notes?: string | null
          placement?:
            | Database["public"]["Enums"]["deliverable_placement"]
            | null
          resolution?: string | null
          resolution_ok?: boolean
          safe_zone_ok?: boolean
          spec_checked?: boolean | null
          status?: string | null
          updated_at?: string
          upload_ready?: boolean
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
      frames: {
        Row: {
          actual_cost: number | null
          aspect_ratio: string | null
          brand_id: string | null
          brief_id: string | null
          cost_estimate: number | null
          cost_source: string | null
          created_at: string
          error_message: string | null
          file_url: string | null
          id: string
          image_prompt: string | null
          is_selected: boolean
          job_id: string | null
          model_id: string | null
          negative_prompt: string | null
          purpose: Database["public"]["Enums"]["frame_purpose"]
          reference_image_urls: Json
          seed: number | null
          shot_id: string | null
          status: Database["public"]["Enums"]["frame_status"]
          updated_at: string
          usage_meta: Json | null
          user_id: string
          version: number
        }
        Insert: {
          actual_cost?: number | null
          aspect_ratio?: string | null
          brand_id?: string | null
          brief_id?: string | null
          cost_estimate?: number | null
          cost_source?: string | null
          created_at?: string
          error_message?: string | null
          file_url?: string | null
          id?: string
          image_prompt?: string | null
          is_selected?: boolean
          job_id?: string | null
          model_id?: string | null
          negative_prompt?: string | null
          purpose?: Database["public"]["Enums"]["frame_purpose"]
          reference_image_urls?: Json
          seed?: number | null
          shot_id?: string | null
          status?: Database["public"]["Enums"]["frame_status"]
          updated_at?: string
          usage_meta?: Json | null
          user_id: string
          version?: number
        }
        Update: {
          actual_cost?: number | null
          aspect_ratio?: string | null
          brand_id?: string | null
          brief_id?: string | null
          cost_estimate?: number | null
          cost_source?: string | null
          created_at?: string
          error_message?: string | null
          file_url?: string | null
          id?: string
          image_prompt?: string | null
          is_selected?: boolean
          job_id?: string | null
          model_id?: string | null
          negative_prompt?: string | null
          purpose?: Database["public"]["Enums"]["frame_purpose"]
          reference_image_urls?: Json
          seed?: number | null
          shot_id?: string | null
          status?: Database["public"]["Enums"]["frame_status"]
          updated_at?: string
          usage_meta?: Json | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "frames_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frames_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frames_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      image_model_tiers: {
        Row: {
          created_at: string
          description: string | null
          draft_cost: number | null
          draft_model_id: string | null
          final_cost: number | null
          final_model_id: string
          id: string
          job_type: string
          label: string
          sort_order: number
          supports_reference: boolean
          supports_text_in_image: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          draft_cost?: number | null
          draft_model_id?: string | null
          final_cost?: number | null
          final_model_id: string
          id?: string
          job_type: string
          label: string
          sort_order?: number
          supports_reference?: boolean
          supports_text_in_image?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          draft_cost?: number | null
          draft_model_id?: string | null
          final_cost?: number | null
          final_model_id?: string
          id?: string
          job_type?: string
          label?: string
          sort_order?: number
          supports_reference?: boolean
          supports_text_in_image?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          source: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          source?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          source?: string | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          action_taken: Database["public"]["Enums"]["metric_action"]
          clicks: number | null
          conversions: number | null
          cpa: number | null
          created_at: string
          ctr: number | null
          date: string
          deliverable_id: string
          diagnosis: string | null
          hold_rate: number | null
          hook_rate: number | null
          id: string
          impressions: number | null
          notes: string | null
          reach: number | null
          roas: number | null
          spend: number | null
          test_cell_id: string | null
          three_sec_views: number | null
          thumbstop_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken?: Database["public"]["Enums"]["metric_action"]
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          deliverable_id: string
          diagnosis?: string | null
          hold_rate?: number | null
          hook_rate?: number | null
          id?: string
          impressions?: number | null
          notes?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          test_cell_id?: string | null
          three_sec_views?: number | null
          thumbstop_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken?: Database["public"]["Enums"]["metric_action"]
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          deliverable_id?: string
          diagnosis?: string | null
          hold_rate?: number | null
          hook_rate?: number | null
          id?: string
          impressions?: number | null
          notes?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          test_cell_id?: string | null
          three_sec_views?: number | null
          thumbstop_rate?: number | null
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
          {
            foreignKeyName: "metrics_test_cell_id_fkey"
            columns: ["test_cell_id"]
            isOneToOne: false
            referencedRelation: "test_cells"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          model_id: string
          notes: string | null
          operation: string
          unit: Database["public"]["Enums"]["pricing_unit"]
          updated_at: string
          usd_unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          model_id: string
          notes?: string | null
          operation: string
          unit: Database["public"]["Enums"]["pricing_unit"]
          updated_at?: string
          usd_unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          model_id?: string
          notes?: string | null
          operation?: string
          unit?: Database["public"]["Enums"]["pricing_unit"]
          updated_at?: string
          usd_unit_cost?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          display_currency: Database["public"]["Enums"]["display_currency"]
          email: string | null
          full_name: string | null
          fx_rate_inr_per_usd: number
          id: string
          low_balance_threshold: number
          markup_multiplier: number
          per_user_spend_cap: number | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          display_currency?: Database["public"]["Enums"]["display_currency"]
          email?: string | null
          full_name?: string | null
          fx_rate_inr_per_usd?: number
          id: string
          low_balance_threshold?: number
          markup_multiplier?: number
          per_user_spend_cap?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          display_currency?: Database["public"]["Enums"]["display_currency"]
          email?: string | null
          full_name?: string | null
          fx_rate_inr_per_usd?: number
          id?: string
          low_balance_threshold?: number
          markup_multiplier?: number
          per_user_spend_cap?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      prompt_library: {
        Row: {
          archetype: string | null
          category: Database["public"]["Enums"]["library_category"]
          created_at: string
          entry_point: string | null
          id: string
          is_favorite: boolean
          notes: string | null
          performance_tag: string | null
          prompt_text: string | null
          source_brand_id: string | null
          source_metric: string | null
          times_used: number
          title: string
          tool: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype?: string | null
          category?: Database["public"]["Enums"]["library_category"]
          created_at?: string
          entry_point?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string | null
          performance_tag?: string | null
          prompt_text?: string | null
          source_brand_id?: string | null
          source_metric?: string | null
          times_used?: number
          title: string
          tool?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype?: string | null
          category?: Database["public"]["Enums"]["library_category"]
          created_at?: string
          entry_point?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string | null
          performance_tag?: string | null
          prompt_text?: string | null
          source_brand_id?: string | null
          source_metric?: string | null
          times_used?: number
          title?: string
          tool?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_library_source_brand_id_fkey"
            columns: ["source_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_reviews: {
        Row: {
          ai_disclosure_ok: boolean | null
          brand_ok: boolean | null
          brief_id: string
          captions_ok: boolean | null
          claims_ok: boolean | null
          claims_substantiated_ok: boolean | null
          created_at: string
          disclosures_ok: boolean | null
          id: string
          legal_copy_ok: boolean | null
          likeness_ok: boolean | null
          notes: Json | null
          policy_ok: boolean | null
          reviewed_at: string | null
          reviewer: string | null
          safe_zones_ok: boolean | null
          signed_off: boolean | null
          specs_ok: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_disclosure_ok?: boolean | null
          brand_ok?: boolean | null
          brief_id: string
          captions_ok?: boolean | null
          claims_ok?: boolean | null
          claims_substantiated_ok?: boolean | null
          created_at?: string
          disclosures_ok?: boolean | null
          id?: string
          legal_copy_ok?: boolean | null
          likeness_ok?: boolean | null
          notes?: Json | null
          policy_ok?: boolean | null
          reviewed_at?: string | null
          reviewer?: string | null
          safe_zones_ok?: boolean | null
          signed_off?: boolean | null
          specs_ok?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_disclosure_ok?: boolean | null
          brand_ok?: boolean | null
          brief_id?: string
          captions_ok?: boolean | null
          claims_ok?: boolean | null
          claims_substantiated_ok?: boolean | null
          created_at?: string
          disclosures_ok?: boolean | null
          id?: string
          legal_copy_ok?: boolean | null
          likeness_ok?: boolean | null
          notes?: Json | null
          policy_ok?: boolean | null
          reviewed_at?: string | null
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
          desire_beat: string | null
          duration_seconds: number | null
          full_script: string | null
          hook: string | null
          id: string
          on_screen_text: string | null
          proof_beat: string | null
          status: Database["public"]["Enums"]["script_status"]
          target_duration: number | null
          updated_at: string
          user_id: string
          vo_script: string | null
          works_sound_off: boolean
        }
        Insert: {
          angle_id: string
          archetype?: string | null
          body?: string | null
          created_at?: string
          cta?: string | null
          desire_beat?: string | null
          duration_seconds?: number | null
          full_script?: string | null
          hook?: string | null
          id?: string
          on_screen_text?: string | null
          proof_beat?: string | null
          status?: Database["public"]["Enums"]["script_status"]
          target_duration?: number | null
          updated_at?: string
          user_id: string
          vo_script?: string | null
          works_sound_off?: boolean
        }
        Update: {
          angle_id?: string
          archetype?: string | null
          body?: string | null
          created_at?: string
          cta?: string | null
          desire_beat?: string | null
          duration_seconds?: number | null
          full_script?: string | null
          hook?: string | null
          id?: string
          on_screen_text?: string | null
          proof_beat?: string | null
          status?: Database["public"]["Enums"]["script_status"]
          target_duration?: number | null
          updated_at?: string
          user_id?: string
          vo_script?: string | null
          works_sound_off?: boolean
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
      shot_prompt_revisions: {
        Row: {
          asset_id: string | null
          compiled_audio: string | null
          compiled_for_tool: string | null
          compiled_negative: string | null
          compiled_prompt: string | null
          created_at: string
          id: string
          note: string | null
          seed: number | null
          shot_id: string
          source: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          compiled_audio?: string | null
          compiled_for_tool?: string | null
          compiled_negative?: string | null
          compiled_prompt?: string | null
          created_at?: string
          id?: string
          note?: string | null
          seed?: number | null
          shot_id: string
          source?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          compiled_audio?: string | null
          compiled_for_tool?: string | null
          compiled_negative?: string | null
          compiled_prompt?: string | null
          created_at?: string
          id?: string
          note?: string | null
          seed?: number | null
          shot_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shot_prompt_revisions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shot_prompt_revisions_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      shots: {
        Row: {
          action: string | null
          ambient: string | null
          assigned_tool: string | null
          audio_note: string | null
          camera_move: string | null
          caption_text: string | null
          compiled_at: string | null
          compiled_audio: string | null
          compiled_for_tool: string | null
          compiled_negative: string | null
          compiled_prompt: string | null
          created_at: string
          dialogue: string | null
          duration_seconds: number | null
          generation_method: Database["public"]["Enums"]["shot_generation_method"]
          id: string
          lens: string | null
          lighting: string | null
          mood: string | null
          motion_intensity: string | null
          needs_generated_anchor: boolean
          negative_prompt: string | null
          prompt_word_target: number
          reference_image_url: string | null
          reference_notes: string | null
          script_id: string
          seed: number | null
          setting: string | null
          sfx: string | null
          shot_number: number | null
          style_grade: string | null
          subject: string | null
          subject_tokens: string | null
          tool_reason: string | null
          updated_at: string
          user_id: string
          visual_description: string | null
        }
        Insert: {
          action?: string | null
          ambient?: string | null
          assigned_tool?: string | null
          audio_note?: string | null
          camera_move?: string | null
          caption_text?: string | null
          compiled_at?: string | null
          compiled_audio?: string | null
          compiled_for_tool?: string | null
          compiled_negative?: string | null
          compiled_prompt?: string | null
          created_at?: string
          dialogue?: string | null
          duration_seconds?: number | null
          generation_method?: Database["public"]["Enums"]["shot_generation_method"]
          id?: string
          lens?: string | null
          lighting?: string | null
          mood?: string | null
          motion_intensity?: string | null
          needs_generated_anchor?: boolean
          negative_prompt?: string | null
          prompt_word_target?: number
          reference_image_url?: string | null
          reference_notes?: string | null
          script_id: string
          seed?: number | null
          setting?: string | null
          sfx?: string | null
          shot_number?: number | null
          style_grade?: string | null
          subject?: string | null
          subject_tokens?: string | null
          tool_reason?: string | null
          updated_at?: string
          user_id: string
          visual_description?: string | null
        }
        Update: {
          action?: string | null
          ambient?: string | null
          assigned_tool?: string | null
          audio_note?: string | null
          camera_move?: string | null
          caption_text?: string | null
          compiled_at?: string | null
          compiled_audio?: string | null
          compiled_for_tool?: string | null
          compiled_negative?: string | null
          compiled_prompt?: string | null
          created_at?: string
          dialogue?: string | null
          duration_seconds?: number | null
          generation_method?: Database["public"]["Enums"]["shot_generation_method"]
          id?: string
          lens?: string | null
          lighting?: string | null
          mood?: string | null
          motion_intensity?: string | null
          needs_generated_anchor?: boolean
          negative_prompt?: string | null
          prompt_word_target?: number
          reference_image_url?: string | null
          reference_notes?: string | null
          script_id?: string
          seed?: number | null
          setting?: string | null
          sfx?: string | null
          shot_number?: number | null
          style_grade?: string | null
          subject?: string | null
          subject_tokens?: string | null
          tool_reason?: string | null
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
      style_bibles: {
        Row: {
          brand_id: string
          color_grade: string | null
          created_at: string
          default_negative: string | null
          film_look: string | null
          id: string
          lens_feel: string | null
          lighting_signature: string | null
          locked_seed: number | null
          motion_feel: string | null
          notes: string | null
          subject_tokens: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          color_grade?: string | null
          created_at?: string
          default_negative?: string | null
          film_look?: string | null
          id?: string
          lens_feel?: string | null
          lighting_signature?: string | null
          locked_seed?: number | null
          motion_feel?: string | null
          notes?: string | null
          subject_tokens?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          color_grade?: string | null
          created_at?: string
          default_negative?: string | null
          film_look?: string | null
          id?: string
          lens_feel?: string | null
          lighting_signature?: string | null
          locked_seed?: number | null
          motion_feel?: string | null
          notes?: string | null
          subject_tokens?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_bibles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cells: {
        Row: {
          ad_name: string | null
          angle_id: string | null
          campaign_id: string
          created_at: string
          deliverable_id: string | null
          format_label: string | null
          hook_label: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["test_cell_status"]
          updated_at: string
          user_id: string
          utm_url: string | null
        }
        Insert: {
          ad_name?: string | null
          angle_id?: string | null
          campaign_id: string
          created_at?: string
          deliverable_id?: string | null
          format_label?: string | null
          hook_label?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["test_cell_status"]
          updated_at?: string
          user_id?: string
          utm_url?: string | null
        }
        Update: {
          ad_name?: string | null
          angle_id?: string | null
          campaign_id?: string
          created_at?: string
          deliverable_id?: string | null
          format_label?: string | null
          hook_label?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["test_cell_status"]
          updated_at?: string
          user_id?: string
          utm_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_cells_angle_id_fkey"
            columns: ["angle_id"]
            isOneToOne: false
            referencedRelation: "angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cells_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cells_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_platform_overview: {
        Args: never
        Returns: {
          active_users: number
          suspended_users: number
          total_charged_usd_equiv: number
          total_consumed_usd: number
          total_reserved_usd: number
          total_topped_up_usd: number
          total_users: number
        }[]
      }
      admin_topup_credit: {
        Args: { p_amount: number; p_note?: string; p_user_id: string }
        Returns: {
          currency: Database["public"]["Enums"]["display_currency"]
          ledger_id: string
          new_balance: number
        }[]
      }
      capture_credit: {
        Args: { p_actual_usd: number; p_ledger_id: string }
        Returns: undefined
      }
      get_balance: {
        Args: { p_user_id: string }
        Returns: {
          available: number
          reserved_amount: number
          total_consumed: number
          total_topped_up: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_credit: { Args: { p_ledger_id: string }; Returns: undefined }
      reserve_credit: {
        Args: {
          p_brand_id: string
          p_brief_id: string
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["ledger_entity_type"]
          p_estimated_usd: number
          p_model_id: string
          p_operation: string
          p_user_id: string
        }
        Returns: {
          available_after: number
          charged_amount: number
          currency: Database["public"]["Enums"]["display_currency"]
          ledger_id: string
        }[]
      }
    }
    Enums: {
      account_status: "active" | "suspended"
      angle_entry_point:
        | "pain"
        | "outcome"
        | "objection"
        | "social_proof"
        | "identity"
        | "curiosity"
      angle_status: "draft" | "approved" | "archived"
      app_role: "super_admin" | "user"
      asset_status: "queued" | "generating" | "review" | "approved" | "rejected"
      asset_type: "clip" | "voiceover" | "music" | "sfx"
      brief_objective:
        | "awareness"
        | "traffic"
        | "engagement"
        | "leads"
        | "sales"
      brief_status: "draft" | "locked" | "in_production" | "live" | "archived"
      campaign_type: "advantage_plus" | "manual_abo" | "manual_cbo"
      deliverable_aspect: "9:16" | "4:5" | "1:1"
      deliverable_placement: "reels" | "feed" | "stories"
      display_currency: "INR" | "USD"
      frame_purpose:
        | "anchor_frame"
        | "hero_shot"
        | "establishing"
        | "character"
        | "style_ref"
      frame_status: "queued" | "generating" | "review" | "approved" | "rejected"
      ledger_entity_type:
        | "brand"
        | "brief"
        | "angle"
        | "script"
        | "shot"
        | "asset"
        | "frame"
        | "none"
      ledger_status: "reserved" | "captured" | "refunded" | "posted"
      ledger_type: "topup" | "debit" | "refund" | "adjustment"
      library_category:
        | "generation_prompt"
        | "script_template"
        | "hook_formula"
        | "shot_recipe"
        | "vo_style"
        | "style_ref"
        | "hero_shot"
      metric_action:
        | "none"
        | "scale"
        | "iterate_hook"
        | "iterate_body"
        | "iterate_offer"
        | "kill"
      pricing_unit:
        | "per_second"
        | "per_image"
        | "per_1k_input_tokens"
        | "per_1k_output_tokens"
        | "per_1k_chars"
        | "per_call"
      render_tier: "draft" | "final"
      script_status: "draft" | "approved" | "archived"
      shot_generation_method: "text-to-video" | "image-to-video"
      test_cell_status: "planned" | "live" | "paused" | "winner" | "killed"
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
      account_status: ["active", "suspended"],
      angle_entry_point: [
        "pain",
        "outcome",
        "objection",
        "social_proof",
        "identity",
        "curiosity",
      ],
      angle_status: ["draft", "approved", "archived"],
      app_role: ["super_admin", "user"],
      asset_status: ["queued", "generating", "review", "approved", "rejected"],
      asset_type: ["clip", "voiceover", "music", "sfx"],
      brief_objective: ["awareness", "traffic", "engagement", "leads", "sales"],
      brief_status: ["draft", "locked", "in_production", "live", "archived"],
      campaign_type: ["advantage_plus", "manual_abo", "manual_cbo"],
      deliverable_aspect: ["9:16", "4:5", "1:1"],
      deliverable_placement: ["reels", "feed", "stories"],
      display_currency: ["INR", "USD"],
      frame_purpose: [
        "anchor_frame",
        "hero_shot",
        "establishing",
        "character",
        "style_ref",
      ],
      frame_status: ["queued", "generating", "review", "approved", "rejected"],
      ledger_entity_type: [
        "brand",
        "brief",
        "angle",
        "script",
        "shot",
        "asset",
        "frame",
        "none",
      ],
      ledger_status: ["reserved", "captured", "refunded", "posted"],
      ledger_type: ["topup", "debit", "refund", "adjustment"],
      library_category: [
        "generation_prompt",
        "script_template",
        "hook_formula",
        "shot_recipe",
        "vo_style",
        "style_ref",
        "hero_shot",
      ],
      metric_action: [
        "none",
        "scale",
        "iterate_hook",
        "iterate_body",
        "iterate_offer",
        "kill",
      ],
      pricing_unit: [
        "per_second",
        "per_image",
        "per_1k_input_tokens",
        "per_1k_output_tokens",
        "per_1k_chars",
        "per_call",
      ],
      render_tier: ["draft", "final"],
      script_status: ["draft", "approved", "archived"],
      shot_generation_method: ["text-to-video", "image-to-video"],
      test_cell_status: ["planned", "live", "paused", "winner", "killed"],
    },
  },
} as const
