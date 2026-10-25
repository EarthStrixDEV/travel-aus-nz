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
      audit_log: {
        Row: {
          action: string
          actor: string | null
          at: string | null
          diff: Json | null
          id: number
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string | null
          diff?: Json | null
          id?: number
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string | null
          diff?: Json | null
          id?: number
          row_id?: string
          table_name?: string
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
      checklist_templates: {
        Row: {
          applies_to: Database["public"]["Enums"]["country_code"][]
          category: string
          detail_i18n: Json | null
          due_offset_days: number | null
          id: number
          sort: number | null
          title_i18n: Json
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["country_code"][]
          category: string
          detail_i18n?: Json | null
          due_offset_days?: number | null
          id?: number
          sort?: number | null
          title_i18n: Json
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["country_code"][]
          category?: string
          detail_i18n?: Json | null
          due_offset_days?: number | null
          id?: number
          sort?: number | null
          title_i18n?: Json
        }
        Relationships: []
      }
      cities: {
        Row: {
          center: unknown
          id: number
          name_i18n: Json
          region_id: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          timezone: string
        }
        Insert: {
          center: unknown
          id?: number
          name_i18n: Json
          region_id: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          timezone: string
        }
        Update: {
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
      city_climate: {
        Row: {
          avg_high_c: number | null
          avg_low_c: number | null
          city_id: number
          month: number
          rain_days: number | null
        }
        Insert: {
          avg_high_c?: number | null
          avg_low_c?: number | null
          city_id: number
          month: number
          rain_days?: number | null
        }
        Update: {
          avg_high_c?: number | null
          avg_low_c?: number | null
          city_id?: number
          month?: number
          rain_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "city_climate_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["saved_entity"]
          note_i18n: Json | null
          position: number
        }
        Insert: {
          collection_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["saved_entity"]
          note_i18n?: Json | null
          position: number
        }
        Update: {
          collection_id?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["saved_entity"]
          note_i18n?: Json | null
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
          cover_media_id: string | null
          id: string
          intro_i18n: Json | null
          kind: string
          placement: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title_i18n: Json
          updated_at: string | null
        }
        Insert: {
          cover_media_id?: string | null
          id?: string
          intro_i18n?: Json | null
          kind: string
          placement?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n: Json
          updated_at?: string | null
        }
        Update: {
          cover_media_id?: string | null
          id?: string
          intro_i18n?: Json | null
          kind?: string
          placement?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      content_feedback: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          id: number
          kind: string | null
          note: string | null
          resolved: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: number
          kind?: string | null
          note?: string | null
          resolved?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
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
          city_id: number | null
          country: Database["public"]["Enums"]["country_code"]
          currency: string
          id: number
          label_i18n: Json
          price_local: number
          sort: number | null
          verified_at: string
        }
        Insert: {
          city_id?: number | null
          country: Database["public"]["Enums"]["country_code"]
          currency: string
          id?: number
          label_i18n: Json
          price_local: number
          sort?: number | null
          verified_at: string
        }
        Update: {
          city_id?: number | null
          country?: Database["public"]["Enums"]["country_code"]
          currency?: string
          id?: number
          label_i18n?: Json
          price_local?: number
          sort?: number | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_reference_items_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
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
      dish_categories: {
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
      dish_venues: {
        Row: {
          dish_id: string
          editor_note_i18n: Json | null
          place_id: string
          price_local: number | null
          rank: number
          verified_at: string | null
        }
        Insert: {
          dish_id: string
          editor_note_i18n?: Json | null
          place_id: string
          price_local?: number | null
          rank?: number
          verified_at?: string | null
        }
        Update: {
          dish_id?: string
          editor_note_i18n?: Json | null
          place_id?: string
          price_local?: number | null
          rank?: number
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
        ]
      }
      dishes: {
        Row: {
          category_id: number | null
          country: Database["public"]["Enums"]["country_code"]
          cover_media_id: string | null
          dietary: string[] | null
          id: string
          name_i18n: Json
          region_id: number | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          story_i18n: Json | null
          taste_i18n: Json | null
          typical_price_local: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category_id?: number | null
          country: Database["public"]["Enums"]["country_code"]
          cover_media_id?: string | null
          dietary?: string[] | null
          id?: string
          name_i18n: Json
          region_id?: number | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          story_i18n?: Json | null
          taste_i18n?: Json | null
          typical_price_local?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category_id?: number | null
          country?: Database["public"]["Enums"]["country_code"]
          cover_media_id?: string | null
          dietary?: string[] | null
          id?: string
          name_i18n?: Json
          region_id?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          story_i18n?: Json | null
          taste_i18n?: Json | null
          typical_price_local?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dish_categories"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "dishes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_alerts: {
        Row: {
          active: boolean | null
          base: string | null
          direction: string | null
          id: string
          last_fired_at: string | null
          quote: string | null
          threshold: number | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          base?: string | null
          direction?: string | null
          id?: string
          last_fired_at?: string | null
          quote?: string | null
          threshold?: number | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          base?: string | null
          direction?: string | null
          id?: string
          last_fired_at?: string | null
          quote?: string | null
          threshold?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base: string
          fetched_at: string
          quote: string
          rate: number
          source: string
        }
        Insert: {
          base: string
          fetched_at: string
          quote: string
          rate: number
          source: string
        }
        Update: {
          base?: string
          fetched_at?: string
          quote?: string
          rate?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_base_fkey"
            columns: ["base"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_rates_quote_fkey"
            columns: ["quote"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      fx_rates_daily: {
        Row: {
          base: string
          close: number | null
          day: string
          high: number | null
          low: number | null
          open: number | null
          quote: string
        }
        Insert: {
          base: string
          close?: number | null
          day: string
          high?: number | null
          low?: number | null
          open?: number | null
          quote: string
        }
        Update: {
          base?: string
          close?: number | null
          day?: string
          high?: number | null
          low?: number | null
          open?: number | null
          quote?: string
        }
        Relationships: []
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
          created_at: string | null
          credit: string | null
          height: number | null
          id: string
          license: string
          path: string
          width: number | null
        }
        Insert: {
          alt_i18n?: Json | null
          created_at?: string | null
          credit?: string | null
          height?: number | null
          id?: string
          license: string
          path: string
          width?: number | null
        }
        Update: {
          alt_i18n?: Json | null
          created_at?: string | null
          credit?: string | null
          height?: number | null
          id?: string
          license?: string
          path?: string
          width?: number | null
        }
        Relationships: []
      }
      official_links: {
        Row: {
          agency: string
          content_hash: string | null
          country: Database["public"]["Enums"]["country_code"]
          health_status: string | null
          id: number
          last_checked_at: string | null
          title_i18n: Json
          url: string
        }
        Insert: {
          agency: string
          content_hash?: string | null
          country: Database["public"]["Enums"]["country_code"]
          health_status?: string | null
          id?: number
          last_checked_at?: string | null
          title_i18n: Json
          url: string
        }
        Update: {
          agency?: string
          content_hash?: string | null
          country?: Database["public"]["Enums"]["country_code"]
          health_status?: string | null
          id?: number
          last_checked_at?: string | null
          title_i18n?: Json
          url?: string
        }
        Relationships: []
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
          address: string | null
          body_i18n: Json | null
          city_id: number
          cover_media_id: string | null
          geom: unknown
          id: string
          is_closed: boolean
          name_i18n: Json
          phone: string | null
          price_level: number | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          summary_i18n: Json | null
          type: Database["public"]["Enums"]["place_type"]
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          body_i18n?: Json | null
          city_id: number
          cover_media_id?: string | null
          geom: unknown
          id?: string
          is_closed?: boolean
          name_i18n: Json
          phone?: string | null
          price_level?: number | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          summary_i18n?: Json | null
          type: Database["public"]["Enums"]["place_type"]
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          body_i18n?: Json | null
          city_id?: number
          cover_media_id?: string | null
          geom?: unknown
          id?: string
          is_closed?: boolean
          name_i18n?: Json
          phone?: string | null
          price_level?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          summary_i18n?: Json | null
          type?: Database["public"]["Enums"]["place_type"]
          updated_at?: string
          updated_by?: string | null
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
            foreignKeyName: "places_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
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
          created_at: string
          display_name: string | null
          home_currency: string
          id: string
          locale: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          home_currency?: string
          id: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          home_currency?: string
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      regions: {
        Row: {
          country: Database["public"]["Enums"]["country_code"]
          id: number
          name_i18n: Json
          slug: string
          sort: number | null
        }
        Insert: {
          country: Database["public"]["Enums"]["country_code"]
          id?: number
          name_i18n: Json
          slug: string
          sort?: number | null
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"]
          id?: number
          name_i18n?: Json
          slug?: string
          sort?: number | null
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          route_id: number
          seq: number
          stop_id: number
        }
        Insert: {
          route_id: number
          seq: number
          stop_id: number
        }
        Update: {
          route_id?: number
          seq?: number
          stop_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transit_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "transit_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["saved_entity"]
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["saved_entity"]
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["saved_entity"]
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      section_links: {
        Row: {
          link_id: number
          section_id: number
        }
        Insert: {
          link_id: number
          section_id: number
        }
        Update: {
          link_id?: number
          section_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_links_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "official_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_links_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "visa_guide_sections"
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
          city_id: number | null
          gtfs_url: string | null
          id: number
          name: string
          website: string | null
        }
        Insert: {
          city_id?: number | null
          gtfs_url?: string | null
          id?: number
          name: string
          website?: string | null
        }
        Update: {
          city_id?: number | null
          gtfs_url?: string | null
          id?: number
          name?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transit_agencies_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_cards: {
        Row: {
          city_id: number | null
          how_to_i18n: Json | null
          id: number
          name: string
          official_url: string | null
          verified_at: string | null
        }
        Insert: {
          city_id?: number | null
          how_to_i18n?: Json | null
          id?: number
          name: string
          official_url?: string | null
          verified_at?: string | null
        }
        Update: {
          city_id?: number | null
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
      transit_routes: {
        Row: {
          agency_id: number
          gtfs_route_id: string | null
          id: number
          long_name_i18n: Json | null
          mode: Database["public"]["Enums"]["transit_mode"]
          shape: unknown
          short_name: string | null
        }
        Insert: {
          agency_id: number
          gtfs_route_id?: string | null
          id?: number
          long_name_i18n?: Json | null
          mode: Database["public"]["Enums"]["transit_mode"]
          shape?: unknown
          short_name?: string | null
        }
        Update: {
          agency_id?: number
          gtfs_route_id?: string | null
          id?: number
          long_name_i18n?: Json | null
          mode?: Database["public"]["Enums"]["transit_mode"]
          shape?: unknown
          short_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transit_routes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "transit_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_stops: {
        Row: {
          agency_id: number
          geom: unknown
          gtfs_stop_id: string | null
          id: number
          name: string
        }
        Insert: {
          agency_id: number
          geom: unknown
          gtfs_stop_id?: string | null
          id?: number
          name: string
        }
        Update: {
          agency_id?: number
          geom?: unknown
          gtfs_stop_id?: string | null
          id?: number
          name?: string
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
      trip_budget_items: {
        Row: {
          amount: number
          category: string
          currency: string
          id: string
          per_day: boolean | null
          trip_id: string
        }
        Insert: {
          amount: number
          category: string
          currency: string
          id?: string
          per_day?: boolean | null
          trip_id: string
        }
        Update: {
          amount?: number
          category?: string
          currency?: string
          id?: string
          per_day?: boolean | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_checklist_items: {
        Row: {
          category: string
          done: boolean
          due_date: string | null
          id: string
          note: string | null
          sort: number | null
          template_id: number | null
          title: string
          trip_id: string
        }
        Insert: {
          category: string
          done?: boolean
          due_date?: string | null
          id?: string
          note?: string | null
          sort?: number | null
          template_id?: number | null
          title: string
          trip_id: string
        }
        Update: {
          category?: string
          done?: boolean
          due_date?: string | null
          id?: string
          note?: string | null
          sort?: number | null
          template_id?: number | null
          title?: string
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
      trip_cities: {
        Row: {
          arrive: string | null
          city_id: number
          depart: string | null
          trip_id: string
        }
        Insert: {
          arrive?: string | null
          city_id: number
          depart?: string | null
          trip_id: string
        }
        Update: {
          arrive?: string | null
          city_id?: number
          depart?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          end_date: string | null
          home_currency: string
          id: string
          share_token: string | null
          start_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          home_currency?: string
          id?: string
          share_token?: string | null
          start_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          home_currency?: string
          id?: string
          share_token?: string | null
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
      visa_guide_sections: {
        Row: {
          body_i18n: Json
          country: Database["public"]["Enums"]["country_code"]
          id: number
          last_verified_at: string
          needs_review: boolean
          purpose: string
          sort: number | null
          status: Database["public"]["Enums"]["content_status"]
          title_i18n: Json
        }
        Insert: {
          body_i18n: Json
          country: Database["public"]["Enums"]["country_code"]
          id?: number
          last_verified_at: string
          needs_review?: boolean
          purpose: string
          sort?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n: Json
        }
        Update: {
          body_i18n?: Json
          country?: Database["public"]["Enums"]["country_code"]
          id?: number
          last_verified_at?: string
          needs_review?: boolean
          purpose?: string
          sort?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title_i18n?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_editor: { Args: never; Returns: boolean }
      is_open_now: { Args: { p_at: string; p_place: string }; Returns: boolean }
    }
    Enums: {
      content_status: "draft" | "published" | "archived"
      country_code: "AU" | "NZ"
      place_type:
        | "attraction"
        | "restaurant"
        | "bar"
        | "cafe"
        | "market"
        | "viewpoint"
      saved_entity: "place" | "dish" | "collection"
      transit_mode: "train" | "metro" | "tram" | "bus" | "ferry" | "coach"
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
        "market",
        "viewpoint",
      ],
      saved_entity: ["place", "dish", "collection"],
      transit_mode: ["train", "metro", "tram", "bus", "ferry", "coach"],
      user_role: ["user", "editor", "admin"],
    },
  },
} as const
