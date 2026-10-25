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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      airport_transfers: {
        Row: {
          airport_code: string | null
          city_id: number | null
          currency: string | null
          duration_min: number | null
          fare_max: number | null
          fare_min: number | null
          id: number
          mode: Database["public"]["Enums"]["transit_mode"] | null
          option_name: string | null
          verified_at: string | null
        }
        Insert: {
          airport_code?: string | null
          city_id?: number | null
          currency?: string | null
          duration_min?: number | null
          fare_max?: number | null
          fare_min?: number | null
          id?: number
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          option_name?: string | null
          verified_at?: string | null
        }
        Update: {
          airport_code?: string | null
          city_id?: number | null
          currency?: string | null
          duration_min?: number | null
          fare_max?: number | null
          fare_min?: number | null
          id?: number
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          option_name?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "airport_transfers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          actor: string | null
          at: string | null
          diff: Json | null
          id: number
          row_id: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          actor?: string | null
          at?: string | null
          diff?: Json | null
          id?: number
          row_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          actor?: string | null
          at?: string | null
          diff?: Json | null
          id?: number
          row_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_presets: {
        Row: {
          country: Database["public"]["Enums"]["country_code"]
          note_i18n: Json | null
          per_day: number
          style: string
        }
        Insert: {
          country: Database["public"]["Enums"]["country_code"]
          note_i18n?: Json | null
          per_day: number
          style: string
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"]
          note_i18n?: Json | null
          per_day?: number
          style?: string
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          applies_to: Database["public"]["Enums"]["country_code"][] | null
          id: number
          moment: string
          note_i18n: Json | null
          slug: string | null
          sort: number | null
          title_i18n: Json | null
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["country_code"][] | null
          id?: number
          moment: string
          note_i18n?: Json | null
          slug?: string | null
          sort?: number | null
          title_i18n?: Json | null
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["country_code"][] | null
          id?: number
          moment?: string
          note_i18n?: Json | null
          slug?: string | null
          sort?: number | null
          title_i18n?: Json | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          bbox: unknown
          center: unknown
          id: number
          name_i18n: Json
          region_id: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          timezone: string
        }
        Insert: {
          bbox?: unknown
          center: unknown
          id?: number
          name_i18n: Json
          region_id: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          timezone: string
        }
        Update: {
          bbox?: unknown
          center?: unknown
          id?: number
          name_i18n?: Json
          region_id?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          entity_id: string
          position: number
        }
        Insert: {
          collection_id: string
          entity_id: string
          position: number
        }
        Update: {
          collection_id?: string
          entity_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          id: string
          kind: string
          placement: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          sub_i18n: Json | null
          title_i18n: Json
        }
        Insert: {
          id?: string
          kind: string
          placement?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          sub_i18n?: Json | null
          title_i18n: Json
        }
        Update: {
          id?: string
          kind?: string
          placement?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          sub_i18n?: Json | null
          title_i18n?: Json
        }
        Relationships: []
      }
      connectivity_options: {
        Row: {
          best_i18n: Json | null
          cost_text: string | null
          id: number
          name_i18n: Json | null
          setup_i18n: Json | null
          verified_at: string | null
          watch_i18n: Json | null
        }
        Insert: {
          best_i18n?: Json | null
          cost_text?: string | null
          id?: number
          name_i18n?: Json | null
          setup_i18n?: Json | null
          verified_at?: string | null
          watch_i18n?: Json | null
        }
        Update: {
          best_i18n?: Json | null
          cost_text?: string | null
          id?: number
          name_i18n?: Json | null
          setup_i18n?: Json | null
          verified_at?: string | null
          watch_i18n?: Json | null
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          body_i18n: Json
          key: string
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          body_i18n: Json
          key: string
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          body_i18n?: Json
          key?: string
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      content_feedback: {
        Row: {
          created_at: string | null
          entity: string | null
          id: number
          kind: string | null
          note: string | null
          resolved: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity?: string | null
          id?: number
          kind?: string | null
          note?: string | null
          resolved?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity?: string | null
          id?: number
          kind?: string | null
          note?: string | null
          resolved?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_reference_items: {
        Row: {
          aud: number | null
          id: number
          item_i18n: Json
          note_i18n: Json | null
          nzd: number | null
          sort: number | null
          verified_at: string
        }
        Insert: {
          aud?: number | null
          id?: number
          item_i18n: Json
          note_i18n?: Json | null
          nzd?: number | null
          sort?: number | null
          verified_at: string
        }
        Update: {
          aud?: number | null
          id?: number
          item_i18n?: Json
          note_i18n?: Json | null
          nzd?: number | null
          sort?: number | null
          verified_at?: string
        }
        Relationships: []
      }
      cuisines: {
        Row: {
          id: number
          name_i18n: Json | null
          slug: string | null
        }
        Insert: {
          id?: number
          name_i18n?: Json | null
          slug?: string | null
        }
        Update: {
          id?: number
          name_i18n?: Json | null
          slug?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          decimals: number | null
          name_i18n: Json | null
          symbol: string | null
        }
        Insert: {
          code: string
          decimals?: number | null
          name_i18n?: Json | null
          symbol?: string | null
        }
        Update: {
          code?: string
          decimals?: number | null
          name_i18n?: Json | null
          symbol?: string | null
        }
        Relationships: []
      }
      dish_pairings: {
        Row: {
          dish_id: string
          k_i18n: Json | null
          sort: number
          v_i18n: Json | null
        }
        Insert: {
          dish_id: string
          k_i18n?: Json | null
          sort: number
          v_i18n?: Json | null
        }
        Update: {
          dish_id?: string
          k_i18n?: Json | null
          sort?: number
          v_i18n?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_pairings_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_venues: {
        Row: {
          dish_id: string
          note_i18n: Json | null
          place_id: string
          price_text: string | null
          rank: number
          region_id: number | null
          verified_at: string | null
        }
        Insert: {
          dish_id: string
          note_i18n?: Json | null
          place_id: string
          price_text?: string | null
          rank: number
          region_id?: number | null
          verified_at?: string | null
        }
        Update: {
          dish_id?: string
          note_i18n?: Json | null
          place_id?: string
          price_text?: string | null
          rank?: number
          region_id?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_venues_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_venues_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_venues_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          allergy_i18n: Json | null
          country: Database["public"]["Enums"]["country_code"]
          cover_media_id: string | null
          dietary: string[] | null
          dispute_note_i18n: Json | null
          id: string
          line_i18n: Json | null
          must_try_rank: number | null
          name_i18n: Json
          price_level: number | null
          price_text: string | null
          region_id: number | null
          served_i18n: Json | null
          slug: string
          sort: number | null
          status: Database["public"]["Enums"]["content_status"]
          story_i18n: Json | null
          taste_i18n: Json | null
          type: string
          verified_at: string | null
        }
        Insert: {
          allergy_i18n?: Json | null
          country: Database["public"]["Enums"]["country_code"]
          cover_media_id?: string | null
          dietary?: string[] | null
          dispute_note_i18n?: Json | null
          id?: string
          line_i18n?: Json | null
          must_try_rank?: number | null
          name_i18n: Json
          price_level?: number | null
          price_text?: string | null
          region_id?: number | null
          served_i18n?: Json | null
          slug: string
          sort?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          story_i18n?: Json | null
          taste_i18n?: Json | null
          type: string
          verified_at?: string | null
        }
        Update: {
          allergy_i18n?: Json | null
          country?: Database["public"]["Enums"]["country_code"]
          cover_media_id?: string | null
          dietary?: string[] | null
          dispute_note_i18n?: Json | null
          id?: string
          line_i18n?: Json | null
          must_try_rank?: number | null
          name_i18n?: Json
          price_level?: number | null
          price_text?: string | null
          region_id?: number | null
          served_i18n?: Json | null
          slug?: string
          sort?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          story_i18n?: Json | null
          taste_i18n?: Json | null
          type?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_documents: {
        Row: {
          applies_to: Database["public"]["Enums"]["country_code"][] | null
          id: number
          note_i18n: Json | null
          slug: string | null
          sort: number | null
          title_i18n: Json | null
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["country_code"][] | null
          id?: number
          note_i18n?: Json | null
          slug?: string | null
          sort?: number | null
          title_i18n?: Json | null
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["country_code"][] | null
          id?: number
          note_i18n?: Json | null
          slug?: string | null
          sort?: number | null
          title_i18n?: Json | null
        }
        Relationships: []
      }
      entry_rules: {
        Row: {
          country: Database["public"]["Enums"]["country_code"]
          nationality: string
          needs_review: boolean | null
          permission_id: number | null
          purpose: string
          stay: string
          verified_at: string | null
        }
        Insert: {
          country: Database["public"]["Enums"]["country_code"]
          nationality: string
          needs_review?: boolean | null
          permission_id?: number | null
          purpose: string
          stay: string
          verified_at?: string | null
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"]
          nationality?: string
          needs_review?: boolean | null
          permission_id?: number | null
          purpose?: string
          stay?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_rules_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission_types"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          a_i18n: Json
          id: number
          q_i18n: Json
          scope: string
          sort: number | null
        }
        Insert: {
          a_i18n: Json
          id?: number
          q_i18n: Json
          scope: string
          sort?: number | null
        }
        Update: {
          a_i18n?: Json
          id?: number
          q_i18n?: Json
          scope?: string
          sort?: number | null
        }
        Relationships: []
      }
      fare_rules: {
        Row: {
          agency_id: number | null
          currency: string
          id: number
          mode: Database["public"]["Enums"]["transit_mode"] | null
          rule: Json
          verified_at: string | null
        }
        Insert: {
          agency_id?: number | null
          currency: string
          id?: number
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          rule: Json
          verified_at?: string | null
        }
        Update: {
          agency_id?: number | null
          currency?: string
          id?: number
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          rule?: Json
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fare_rules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "transit_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_daily: {
        Row: {
          close: number | null
          day: string
          quote: string
        }
        Insert: {
          close?: number | null
          day: string
          quote: string
        }
        Update: {
          close?: number | null
          day?: string
          quote?: string
        }
        Relationships: []
      }
      fx_snapshots: {
        Row: {
          base: string
          fetched_at: string
          rates: Json
          source: string
        }
        Insert: {
          base?: string
          fetched_at: string
          rates: Json
          source: string
        }
        Update: {
          base?: string
          fetched_at?: string
          rates?: Json
          source?: string
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          id: string
          media_id: string
          place_id: string
          region_id: number | null
          season: Database["public"]["Enums"]["season"] | null
          sort: number | null
          status: Database["public"]["Enums"]["content_status"]
          title_i18n: Json | null
        }
        Insert: {
          id?: string
          media_id: string
          place_id: string
          region_id?: number | null
          season?: Database["public"]["Enums"]["season"] | null
          sort?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n?: Json | null
        }
        Update: {
          id?: string
          media_id?: string
          place_id?: string
          region_id?: number | null
          season?: Database["public"]["Enums"]["season"] | null
          sort?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photos_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          active: boolean | null
          caption_i18n: Json | null
          id: number
          media_id: string | null
          place_id: string | null
          sort: number | null
        }
        Insert: {
          active?: boolean | null
          caption_i18n?: Json | null
          id?: number
          media_id?: string | null
          place_id?: string | null
          sort?: number | null
        }
        Update: {
          active?: boolean | null
          caption_i18n?: Json | null
          id?: number
          media_id?: string | null
          place_id?: string | null
          sort?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_slides_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_legs: {
        Row: {
          day: number | null
          duration_min: number | null
          frequency_text: string | null
          from_name: string | null
          journey_id: string
          mode: Database["public"]["Enums"]["transit_mode"]
          operator: string | null
          seq: number
          to_name: string | null
        }
        Insert: {
          day?: number | null
          duration_min?: number | null
          frequency_text?: string | null
          from_name?: string | null
          journey_id: string
          mode: Database["public"]["Enums"]["transit_mode"]
          operator?: string | null
          seq: number
          to_name?: string | null
        }
        Update: {
          day?: number | null
          duration_min?: number | null
          frequency_text?: string | null
          from_name?: string | null
          journey_id?: string
          mode?: Database["public"]["Enums"]["transit_mode"]
          operator?: string | null
          seq?: number
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_legs_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          country: Database["public"]["Enums"]["country_code"] | null
          cover_media_id: string | null
          currency: string | null
          days: number | null
          from_name: string | null
          id: string
          kind: string
          line_i18n: Json | null
          modes: Database["public"]["Enums"]["transit_mode"][] | null
          price_from: number | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title_i18n: Json | null
          to_name: string | null
        }
        Insert: {
          country?: Database["public"]["Enums"]["country_code"] | null
          cover_media_id?: string | null
          currency?: string | null
          days?: number | null
          from_name?: string | null
          id?: string
          kind?: string
          line_i18n?: Json | null
          modes?: Database["public"]["Enums"]["transit_mode"][] | null
          price_from?: number | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n?: Json | null
          to_name?: string | null
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"] | null
          cover_media_id?: string | null
          currency?: string | null
          days?: number | null
          from_name?: string | null
          id?: string
          kind?: string
          line_i18n?: Json | null
          modes?: Database["public"]["Enums"]["transit_mode"][] | null
          price_from?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n?: Json | null
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journeys_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      line_service_summary: {
        Row: {
          computed_at: string | null
          end_to_end_min: number | null
          fare_max: number | null
          fare_min: number | null
          headway_offpeak_min: number | null
          headway_peak_min: number | null
          line_id: number
        }
        Insert: {
          computed_at?: string | null
          end_to_end_min?: number | null
          fare_max?: number | null
          fare_min?: number | null
          headway_offpeak_min?: number | null
          headway_peak_min?: number | null
          line_id: number
        }
        Update: {
          computed_at?: string | null
          end_to_end_min?: number | null
          fare_max?: number | null
          fare_min?: number | null
          headway_offpeak_min?: number | null
          headway_peak_min?: number | null
          line_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "line_service_summary_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "transit_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      line_stops: {
        Row: {
          line_id: number
          seq: number
          stop_id: number | null
        }
        Insert: {
          line_id: number
          seq: number
          stop_id?: number | null
        }
        Update: {
          line_id?: number
          seq?: number
          stop_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "line_stops_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "transit_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "transit_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      link_checks: {
        Row: {
          checked_at: string | null
          content_hash: string | null
          final_url: string | null
          id: number
          link_id: number | null
          status_code: number | null
        }
        Insert: {
          checked_at?: string | null
          content_hash?: string | null
          final_url?: string | null
          id?: number
          link_id?: number | null
          status_code?: number | null
        }
        Update: {
          checked_at?: string | null
          content_hash?: string | null
          final_url?: string | null
          id?: number
          link_id?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "link_checks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "official_links"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_i18n: Json | null
          blurhash: string | null
          created_at: string | null
          credit: string
          height: number
          id: string
          license: string
          path: string
          width: number
        }
        Insert: {
          alt_i18n?: Json | null
          blurhash?: string | null
          created_at?: string | null
          credit: string
          height: number
          id?: string
          license: string
          path: string
          width: number
        }
        Update: {
          alt_i18n?: Json | null
          blurhash?: string | null
          created_at?: string | null
          credit?: string
          height?: number
          id?: string
          license?: string
          path?: string
          width?: number
        }
        Relationships: []
      }
      neighbourhoods: {
        Row: {
          city_id: number | null
          geom: unknown
          id: number
          name: string
        }
        Insert: {
          city_id?: number | null
          geom?: unknown
          id?: number
          name: string
        }
        Update: {
          city_id?: number | null
          geom?: unknown
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighbourhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          email: string
          locale: string | null
          token: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          email: string
          locale?: string | null
          token?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          email?: string
          locale?: string | null
          token?: string | null
        }
        Relationships: []
      }
      official_links: {
        Row: {
          agency: string | null
          content_hash: string | null
          country: Database["public"]["Enums"]["country_code"] | null
          health_status: string | null
          id: number
          last_checked_at: string | null
          title_i18n: Json | null
          url: string
        }
        Insert: {
          agency?: string | null
          content_hash?: string | null
          country?: Database["public"]["Enums"]["country_code"] | null
          health_status?: string | null
          id?: number
          last_checked_at?: string | null
          title_i18n?: Json | null
          url: string
        }
        Update: {
          agency?: string | null
          content_hash?: string | null
          country?: Database["public"]["Enums"]["country_code"] | null
          health_status?: string | null
          id?: number
          last_checked_at?: string | null
          title_i18n?: Json | null
          url?: string
        }
        Relationships: []
      }
      packing_items: {
        Row: {
          grp: string | null
          id: number
          season: Database["public"]["Enums"]["season"] | null
          sort: number | null
          title_i18n: Json | null
        }
        Insert: {
          grp?: string | null
          id?: number
          season?: Database["public"]["Enums"]["season"] | null
          sort?: number | null
          title_i18n?: Json | null
        }
        Update: {
          grp?: string | null
          id?: number
          season?: Database["public"]["Enums"]["season"] | null
          sort?: number | null
          title_i18n?: Json | null
        }
        Relationships: []
      }
      permission_types: {
        Row: {
          country: Database["public"]["Enums"]["country_code"]
          fee_text: string | null
          good_i18n: Json | null
          how_i18n: Json | null
          id: number
          name_i18n: Json | null
          needs_review: boolean | null
          official_link_id: number | null
          plain_i18n: Json | null
          processing_text: string | null
          slug: string | null
          validity_text: string | null
          verified_at: string | null
          who_i18n: Json | null
        }
        Insert: {
          country: Database["public"]["Enums"]["country_code"]
          fee_text?: string | null
          good_i18n?: Json | null
          how_i18n?: Json | null
          id?: number
          name_i18n?: Json | null
          needs_review?: boolean | null
          official_link_id?: number | null
          plain_i18n?: Json | null
          processing_text?: string | null
          slug?: string | null
          validity_text?: string | null
          verified_at?: string | null
          who_i18n?: Json | null
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"]
          fee_text?: string | null
          good_i18n?: Json | null
          how_i18n?: Json | null
          id?: number
          name_i18n?: Json | null
          needs_review?: boolean | null
          official_link_id?: number | null
          plain_i18n?: Json | null
          processing_text?: string | null
          slug?: string | null
          validity_text?: string | null
          verified_at?: string | null
          who_i18n?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_types_official_link_id_fkey"
            columns: ["official_link_id"]
            isOneToOne: false
            referencedRelation: "official_links"
            referencedColumns: ["id"]
          },
        ]
      }
      place_hours: {
        Row: {
          close_time: string
          open_time: string
          place_id: string
          weekday: number
        }
        Insert: {
          close_time: string
          open_time: string
          place_id: string
          weekday: number
        }
        Update: {
          close_time?: string
          open_time?: string
          place_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_hours_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_nearby_venues: {
        Row: {
          place_id: string
          sort: number | null
          venue_id: string
        }
        Insert: {
          place_id: string
          sort?: number | null
          venue_id: string
        }
        Update: {
          place_id?: string
          sort?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_nearby_venues_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_nearby_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_stop_links: {
        Row: {
          place_id: string
          rank: number
          stop_id: number
          walk_geom: unknown
          walk_min: number
        }
        Insert: {
          place_id: string
          rank: number
          stop_id: number
          walk_geom?: unknown
          walk_min: number
        }
        Update: {
          place_id?: string
          rank?: number
          stop_id?: number
          walk_geom?: unknown
          walk_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_stop_links_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_stop_links_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "transit_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      place_tags: {
        Row: {
          place_id: string
          tag_id: number
        }
        Insert: {
          place_id: string
          tag_id: number
        }
        Update: {
          place_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_tags_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          access_i18n: Json | null
          area_i18n: Json | null
          best_time_i18n: Json | null
          category: string | null
          city_id: number
          desc_i18n: Json | null
          geom: unknown
          hours_note_i18n: Json | null
          id: string
          is_closed: boolean
          name_i18n: Json
          neighbourhood_id: number | null
          price_level: number | null
          price_note_i18n: Json | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          type: Database["public"]["Enums"]["place_type"]
          updated_at: string | null
          updated_by: string | null
          verified_at: string | null
          website: string | null
        }
        Insert: {
          access_i18n?: Json | null
          area_i18n?: Json | null
          best_time_i18n?: Json | null
          category?: string | null
          city_id: number
          desc_i18n?: Json | null
          geom: unknown
          hours_note_i18n?: Json | null
          id?: string
          is_closed?: boolean
          name_i18n: Json
          neighbourhood_id?: number | null
          price_level?: number | null
          price_note_i18n?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          type: Database["public"]["Enums"]["place_type"]
          updated_at?: string | null
          updated_by?: string | null
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          access_i18n?: Json | null
          area_i18n?: Json | null
          best_time_i18n?: Json | null
          category?: string | null
          city_id?: number
          desc_i18n?: Json | null
          geom?: unknown
          hours_note_i18n?: Json | null
          id?: string
          is_closed?: boolean
          name_i18n?: Json
          neighbourhood_id?: number | null
          price_level?: number | null
          price_note_i18n?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          type?: Database["public"]["Enums"]["place_type"]
          updated_at?: string | null
          updated_by?: string | null
          verified_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_neighbourhood_id_fkey"
            columns: ["neighbourhood_id"]
            isOneToOne: false
            referencedRelation: "neighbourhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          home_currency: string
          id: string
          locale: string
          role: Database["public"]["Enums"]["user_role"]
          theme: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          home_currency?: string
          id: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          home_currency?: string
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string | null
        }
        Relationships: []
      }
      region_months: {
        Row: {
          comfort: number | null
          crowds: number | null
          month: number
          recommended: boolean | null
          region_id: number
        }
        Insert: {
          comfort?: number | null
          crowds?: number | null
          month: number
          recommended?: boolean | null
          region_id: number
        }
        Update: {
          comfort?: number | null
          crowds?: number | null
          month?: number
          recommended?: boolean | null
          region_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "region_months_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          best_months: number[] | null
          country: Database["public"]["Enums"]["country_code"]
          cover_media_id: string | null
          featured_rank: number | null
          id: number
          lede_i18n: Json | null
          name_i18n: Json
          slug: string
          state_i18n: Json | null
          status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          best_months?: number[] | null
          country: Database["public"]["Enums"]["country_code"]
          cover_media_id?: string | null
          featured_rank?: number | null
          id?: number
          lede_i18n?: Json | null
          name_i18n: Json
          slug: string
          state_i18n?: Json | null
          status?: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          best_months?: number[] | null
          country?: Database["public"]["Enums"]["country_code"]
          cover_media_id?: string | null
          featured_rank?: number | null
          id?: number
          lede_i18n?: Json | null
          name_i18n?: Json
          slug?: string
          state_i18n?: Json | null
          status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: [
          {
            foreignKeyName: "regions_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["saved_entity"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["saved_entity"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["saved_entity"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scenic_routes: {
        Row: {
          country: Database["public"]["Enums"]["country_code"] | null
          cover_media_id: string | null
          currency: string | null
          duration_text: string | null
          fare_from: number | null
          frequency_text: string | null
          from_name: string | null
          id: number
          line_i18n: Json | null
          mode: Database["public"]["Enums"]["transit_mode"] | null
          name_i18n: Json | null
          slug: string | null
          status: Database["public"]["Enums"]["content_status"]
          to_name: string | null
        }
        Insert: {
          country?: Database["public"]["Enums"]["country_code"] | null
          cover_media_id?: string | null
          currency?: string | null
          duration_text?: string | null
          fare_from?: number | null
          frequency_text?: string | null
          from_name?: string | null
          id?: number
          line_i18n?: Json | null
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          name_i18n?: Json | null
          slug?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          to_name?: string | null
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"] | null
          cover_media_id?: string | null
          currency?: string | null
          duration_text?: string | null
          fare_from?: number | null
          frequency_text?: string | null
          from_name?: string | null
          id?: number
          line_i18n?: Json | null
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          name_i18n?: Json | null
          slug?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenic_routes_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: number
          kind: string
          name_i18n: Json
          slug: string
        }
        Insert: {
          id?: number
          kind: string
          name_i18n: Json
          slug: string
        }
        Update: {
          id?: number
          kind?: string
          name_i18n?: Json
          slug?: string
        }
        Relationships: []
      }
      transit_agencies: {
        Row: {
          card_id: number | null
          country: Database["public"]["Enums"]["country_code"]
          gtfs_url: string | null
          id: number
          name: string
          website: string | null
        }
        Insert: {
          card_id?: number | null
          country: Database["public"]["Enums"]["country_code"]
          gtfs_url?: string | null
          id?: number
          name: string
          website?: string | null
        }
        Update: {
          card_id?: number | null
          country?: Database["public"]["Enums"]["country_code"]
          gtfs_url?: string | null
          id?: number
          name?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transit_agencies_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "transit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_cards: {
        Row: {
          caps_i18n: Json | null
          city_id: number | null
          contactless: boolean | null
          how_to_i18n: Json | null
          id: number
          name: string
          official_url: string | null
          verified_at: string | null
        }
        Insert: {
          caps_i18n?: Json | null
          city_id?: number | null
          contactless?: boolean | null
          how_to_i18n?: Json | null
          id?: number
          name: string
          official_url?: string | null
          verified_at?: string | null
        }
        Update: {
          caps_i18n?: Json | null
          city_id?: number | null
          contactless?: boolean | null
          how_to_i18n?: Json | null
          id?: number
          name?: string
          official_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transit_cards_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_lines: {
        Row: {
          agency_id: number | null
          city_id: number | null
          gtfs_route_id: string | null
          id: number
          long_name: string | null
          mode: Database["public"]["Enums"]["transit_mode"]
          shape: unknown
          short_name: string | null
        }
        Insert: {
          agency_id?: number | null
          city_id?: number | null
          gtfs_route_id?: string | null
          id?: number
          long_name?: string | null
          mode: Database["public"]["Enums"]["transit_mode"]
          shape?: unknown
          short_name?: string | null
        }
        Update: {
          agency_id?: number | null
          city_id?: number | null
          gtfs_route_id?: string | null
          id?: number
          long_name?: string | null
          mode?: Database["public"]["Enums"]["transit_mode"]
          shape?: unknown
          short_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transit_lines_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "transit_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_lines_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_stops: {
        Row: {
          agency_id: number | null
          geom: unknown
          gtfs_stop_id: string | null
          id: number
          name: string
          step_free: boolean | null
        }
        Insert: {
          agency_id?: number | null
          geom: unknown
          gtfs_stop_id?: string | null
          id?: number
          name: string
          step_free?: boolean | null
        }
        Update: {
          agency_id?: number | null
          geom?: unknown
          gtfs_stop_id?: string | null
          id?: number
          name?: string
          step_free?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "transit_stops_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "transit_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_checklist_items: {
        Row: {
          done: boolean | null
          done_at: string | null
          template_id: number
          trip_id: string
        }
        Insert: {
          done?: boolean | null
          done_at?: string | null
          template_id: number
          trip_id: string
        }
        Update: {
          done?: boolean | null
          done_at?: string | null
          template_id?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_checklist_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          date: string | null
          day_no: number
          id: string
          off_map: boolean | null
          title: string | null
          trip_id: string
        }
        Insert: {
          date?: string | null
          day_no: number
          id?: string
          off_map?: boolean | null
          title?: string | null
          trip_id: string
        }
        Update: {
          date?: string | null
          day_no?: number
          id?: string
          off_map?: boolean | null
          title?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_legs: {
        Row: {
          computed_at: string | null
          duration_min: number | null
          fare_max: number | null
          fare_min: number | null
          from_stop: string
          mode: Database["public"]["Enums"]["transit_mode"] | null
          status: string | null
          summary: string | null
          to_stop: string
        }
        Insert: {
          computed_at?: string | null
          duration_min?: number | null
          fare_max?: number | null
          fare_min?: number | null
          from_stop: string
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          status?: string | null
          summary?: string | null
          to_stop: string
        }
        Update: {
          computed_at?: string | null
          duration_min?: number | null
          fare_max?: number | null
          fare_min?: number | null
          from_stop?: string
          mode?: Database["public"]["Enums"]["transit_mode"] | null
          status?: string | null
          summary?: string | null
          to_stop?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_legs_from_stop_fkey"
            columns: ["from_stop"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_legs_to_stop_fkey"
            columns: ["to_stop"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_packing_items: {
        Row: {
          item_id: number
          packed: boolean | null
          trip_id: string
        }
        Insert: {
          item_id: number
          packed?: boolean | null
          trip_id: string
        }
        Update: {
          item_id?: number
          packed?: boolean | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_packing_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "packing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_packing_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_shares: {
        Row: {
          created_at: string | null
          revoked_at: string | null
          token: string
          trip_id: string | null
        }
        Insert: {
          created_at?: string | null
          revoked_at?: string | null
          token?: string
          trip_id?: string | null
        }
        Update: {
          created_at?: string | null
          revoked_at?: string | null
          token?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          day_id: string
          id: string
          note: string | null
          place_id: string
          position: number
          time: string | null
        }
        Insert: {
          day_id: string
          id?: string
          note?: string | null
          place_id: string
          position: number
          time?: string | null
        }
        Update: {
          day_id?: string
          id?: string
          note?: string | null
          place_id?: string
          position?: number
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          end_date: string | null
          home_currency: string | null
          id: string
          start_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          home_currency?: string | null
          id?: string
          start_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          home_currency?: string | null
          id?: string
          start_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_drinks: {
        Row: {
          drink: string
          place_id: string
        }
        Insert: {
          drink: string
          place_id: string
        }
        Update: {
          drink?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_drinks_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["place_id"]
          },
        ]
      }
      venues: {
        Row: {
          booking: string | null
          cuisine_id: number | null
          dietary: string[] | null
          drinks_i18n: Json | null
          menu_highlights_i18n: Json | null
          place_id: string
        }
        Insert: {
          booking?: string | null
          cuisine_id?: number | null
          dietary?: string[] | null
          drinks_i18n?: Json | null
          menu_highlights_i18n?: Json | null
          place_id: string
        }
        Update: {
          booking?: string | null
          cuisine_id?: number | null
          dietary?: string[] | null
          drinks_i18n?: Json | null
          menu_highlights_i18n?: Json | null
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "cuisines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_editor: { Args: never; Returns: boolean }
      is_open_now: { Args: { p_at: string; p_place: string }; Returns: boolean }
      map_places: {
        Args: {
          max_lat: number
          max_lng: number
          min_lat: number
          min_lng: number
          p_types?: Database["public"]["Enums"]["place_type"][]
          p_zoom: number
        }
        Returns: Json
      }
    }
    Enums: {
      content_status: "draft" | "published" | "archived"
      country_code: "AU" | "NZ"
      place_type:
        | "attraction"
        | "restaurant"
        | "bar"
        | "cafe"
        | "station"
        | "village"
      saved_entity: "place" | "dish" | "journey"
      season: "summer" | "autumn" | "winter" | "spring"
      transit_mode:
        | "train"
        | "metro"
        | "tram"
        | "bus"
        | "coach"
        | "ferry"
        | "walk"
      user_role: "user" | "editor" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_status: ["draft", "published", "archived"],
      country_code: ["AU", "NZ"],
      place_type: [
        "attraction",
        "restaurant",
        "bar",
        "cafe",
        "station",
        "village",
      ],
      saved_entity: ["place", "dish", "journey"],
      season: ["summer", "autumn", "winter", "spring"],
      transit_mode: ["train", "metro", "tram", "bus", "coach", "ferry", "walk"],
      user_role: ["user", "editor", "admin"],
    },
  },
} as const
