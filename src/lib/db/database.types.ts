export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string;
          delivered_via: Database["public"]["Enums"]["alert_delivery_via"];
          id: string;
          level: Database["public"]["Enums"]["alert_level"];
          message_template: string;
          risk_flag_id: string;
        };
        Insert: {
          created_at: string;
          delivered_via?: Database["public"]["Enums"]["alert_delivery_via"];
          id?: string;
          level: Database["public"]["Enums"]["alert_level"];
          message_template: string;
          risk_flag_id: string;
        };
        Update: {
          created_at?: string;
          delivered_via?: Database["public"]["Enums"]["alert_delivery_via"];
          id?: string;
          level?: Database["public"]["Enums"]["alert_level"];
          message_template?: string;
          risk_flag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_risk_flag_id_fkey";
            columns: ["risk_flag_id"];
            isOneToOne: false;
            referencedRelation: "risk_flags";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_records: {
        Row: {
          approver: string;
          decided_at: string;
          decision: Database["public"]["Enums"]["approval_decision"];
          draft_id: string;
          edited_body: string | null;
          id: string;
        };
        Insert: {
          approver: string;
          decided_at: string;
          decision: Database["public"]["Enums"]["approval_decision"];
          draft_id: string;
          edited_body?: string | null;
          id?: string;
        };
        Update: {
          approver?: string;
          decided_at?: string;
          decision?: Database["public"]["Enums"]["approval_decision"];
          draft_id?: string;
          edited_body?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_records_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "comms_drafts";
            referencedColumns: ["id"];
          },
        ];
      };
      comms_drafts: {
        Row: {
          body: string;
          created_at: string;
          generation: number;
          id: string;
          model_used: string;
          recommendation_id: string;
          risk_flag_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["comms_draft_status"];
          subject: string;
          tick_id: string;
          tone: string;
        };
        Insert: {
          body: string;
          created_at: string;
          generation: number;
          id?: string;
          model_used: string;
          recommendation_id: string;
          risk_flag_id: string;
          sent_at?: string | null;
          status: Database["public"]["Enums"]["comms_draft_status"];
          subject: string;
          tick_id: string;
          tone: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          generation?: number;
          id?: string;
          model_used?: string;
          recommendation_id?: string;
          risk_flag_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["comms_draft_status"];
          subject?: string;
          tick_id?: string;
          tone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comms_drafts_recommendation_id_fkey";
            columns: ["recommendation_id"];
            isOneToOne: false;
            referencedRelation: "reorder_recommendations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comms_drafts_risk_flag_id_fkey";
            columns: ["risk_flag_id"];
            isOneToOne: false;
            referencedRelation: "risk_flags";
            referencedColumns: ["id"];
          },
        ];
      };
      reorder_recommendations: {
        Row: {
          created_at: string;
          formula_branch: string;
          id: string;
          inputs_hash: string;
          inventory_position: number;
          is_insufficient_data: boolean;
          rationale_template: string;
          recommended_qty: number;
          risk_flag_id: string;
          rop: number;
          sku_id: string;
          ss: number;
        };
        Insert: {
          created_at: string;
          formula_branch: string;
          id?: string;
          inputs_hash: string;
          inventory_position: number;
          is_insufficient_data: boolean;
          rationale_template: string;
          recommended_qty: number;
          risk_flag_id: string;
          rop: number;
          sku_id: string;
          ss: number;
        };
        Update: {
          created_at?: string;
          formula_branch?: string;
          id?: string;
          inputs_hash?: string;
          inventory_position?: number;
          is_insufficient_data?: boolean;
          rationale_template?: string;
          recommended_qty?: number;
          risk_flag_id?: string;
          rop?: number;
          sku_id?: string;
          ss?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reorder_recommendations_risk_flag_id_fkey";
            columns: ["risk_flag_id"];
            isOneToOne: false;
            referencedRelation: "risk_flags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reorder_recommendations_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
        ];
      };
      risk_flags: {
        Row: {
          computed_lead_time_delta: number;
          created_at: string;
          exposure_type: Database["public"]["Enums"]["exposure_type"];
          id: string;
          severity: Database["public"]["Enums"]["severity"];
          shipment_id: string | null;
          signal_id: string;
          sku_id: string;
          status: Database["public"]["Enums"]["risk_flag_status"];
          tick_id: string;
        };
        Insert: {
          computed_lead_time_delta: number;
          created_at: string;
          exposure_type: Database["public"]["Enums"]["exposure_type"];
          id?: string;
          severity: Database["public"]["Enums"]["severity"];
          shipment_id?: string | null;
          signal_id: string;
          sku_id: string;
          status: Database["public"]["Enums"]["risk_flag_status"];
          tick_id: string;
        };
        Update: {
          computed_lead_time_delta?: number;
          created_at?: string;
          exposure_type?: Database["public"]["Enums"]["exposure_type"];
          id?: string;
          severity?: Database["public"]["Enums"]["severity"];
          shipment_id?: string | null;
          signal_id?: string;
          sku_id?: string;
          status?: Database["public"]["Enums"]["risk_flag_status"];
          tick_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "risk_flags_shipment_id_fkey";
            columns: ["shipment_id"];
            isOneToOne: false;
            referencedRelation: "shipments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_flags_signal_id_fkey";
            columns: ["signal_id"];
            isOneToOne: false;
            referencedRelation: "signals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_flags_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
        ];
      };
      shipments: {
        Row: {
          dest_geo: Json;
          eta: string;
          id: string;
          origin_geo: Json;
          qty: number;
          route_regions: string[];
          sku_id: string;
          status: Database["public"]["Enums"]["shipment_status"];
          supplier_id: string;
        };
        Insert: {
          dest_geo: Json;
          eta: string;
          id?: string;
          origin_geo: Json;
          qty: number;
          route_regions: string[];
          sku_id: string;
          status: Database["public"]["Enums"]["shipment_status"];
          supplier_id: string;
        };
        Update: {
          dest_geo?: Json;
          eta?: string;
          id?: string;
          origin_geo?: Json;
          qty?: number;
          route_regions?: string[];
          sku_id?: string;
          status?: Database["public"]["Enums"]["shipment_status"];
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipments_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shipments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      signals: {
        Row: {
          affected_regions: string[];
          confidence: string;
          dedupe_hash: string;
          delay_days_estimate: number;
          detected_at: string;
          disruption_type: string;
          expires_at: string | null;
          geo: Json;
          id: string;
          raw_ref: string;
          severity: Database["public"]["Enums"]["severity"];
          source: Database["public"]["Enums"]["signal_source"];
          status: Database["public"]["Enums"]["signal_status"];
        };
        Insert: {
          affected_regions: string[];
          confidence: string;
          dedupe_hash: string;
          delay_days_estimate: number;
          detected_at: string;
          disruption_type: string;
          expires_at?: string | null;
          geo: Json;
          id?: string;
          raw_ref: string;
          severity: Database["public"]["Enums"]["severity"];
          source: Database["public"]["Enums"]["signal_source"];
          status: Database["public"]["Enums"]["signal_status"];
        };
        Update: {
          affected_regions?: string[];
          confidence?: string;
          dedupe_hash?: string;
          delay_days_estimate?: number;
          detected_at?: string;
          disruption_type?: string;
          expires_at?: string | null;
          geo?: Json;
          id?: string;
          raw_ref?: string;
          severity?: Database["public"]["Enums"]["severity"];
          source?: Database["public"]["Enums"]["signal_source"];
          status?: Database["public"]["Enums"]["signal_status"];
        };
        Relationships: [];
      };
      skus: {
        Row: {
          avg_daily_demand: number;
          backorders: number;
          demand_std: number;
          holding_cost: number;
          id: string;
          moq: number;
          on_hand: number;
          on_order: number;
          order_cost: number;
          service_level_z: number;
          sku: string;
          supplier_id: string;
          unit_cost: number;
        };
        Insert: {
          avg_daily_demand: number;
          backorders: number;
          demand_std: number;
          holding_cost: number;
          id?: string;
          moq: number;
          on_hand: number;
          on_order: number;
          order_cost: number;
          service_level_z: number;
          sku: string;
          supplier_id: string;
          unit_cost: number;
        };
        Update: {
          avg_daily_demand?: number;
          backorders?: number;
          demand_std?: number;
          holding_cost?: number;
          id?: string;
          moq?: number;
          on_hand?: number;
          on_order?: number;
          order_cost?: number;
          service_level_z?: number;
          sku?: string;
          supplier_id?: string;
          unit_cost?: number;
        };
        Relationships: [
          {
            foreignKeyName: "skus_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          geo: Json;
          id: string;
          lead_time_days_base: number;
          lead_time_std_days: number | null;
          name: string;
          region_code: string;
          reliability: number;
        };
        Insert: {
          geo: Json;
          id?: string;
          lead_time_days_base: number;
          lead_time_std_days?: number | null;
          name: string;
          region_code: string;
          reliability: number;
        };
        Update: {
          geo?: Json;
          id?: string;
          lead_time_days_base?: number;
          lead_time_std_days?: number | null;
          name?: string;
          region_code?: string;
          reliability?: number;
        };
        Relationships: [];
      };
      tick_logs: {
        Row: {
          clock_now: string;
          counts: Json;
          created_at: string;
          duration_ms: number;
          est_cost_usd: number;
          id: string;
          mode: Database["public"]["Enums"]["tick_mode"];
          trigger_source: Database["public"]["Enums"]["tick_trigger_source"];
        };
        Insert: {
          clock_now: string;
          counts: Json;
          created_at: string;
          duration_ms: number;
          est_cost_usd: number;
          id?: string;
          mode: Database["public"]["Enums"]["tick_mode"];
          trigger_source: Database["public"]["Enums"]["tick_trigger_source"];
        };
        Update: {
          clock_now?: string;
          counts?: Json;
          created_at?: string;
          duration_ms?: number;
          est_cost_usd?: number;
          id?: string;
          mode?: Database["public"]["Enums"]["tick_mode"];
          trigger_source?: Database["public"]["Enums"]["tick_trigger_source"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      alert_delivery_via: "dashboard" | "webhook";
      alert_level: "info" | "warning" | "critical";
      approval_decision: "approved" | "rejected";
      comms_draft_status: "pending_approval" | "approved" | "rejected" | "sent";
      exposure_type: "supplier_region" | "shipment_route";
      risk_flag_status: "open" | "ack" | "resolved";
      severity: "low" | "med" | "high" | "unknown";
      shipment_status: "in_transit" | "delivered" | "delayed";
      signal_source: "weather" | "news";
      signal_status: "active" | "stale" | "degraded" | "resolved";
      tick_mode: "live" | "replay";
      tick_trigger_source: "cron" | "manual" | "inject" | "replay";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_delivery_via: ["dashboard", "webhook"],
      alert_level: ["info", "warning", "critical"],
      approval_decision: ["approved", "rejected"],
      comms_draft_status: ["pending_approval", "approved", "rejected", "sent"],
      exposure_type: ["supplier_region", "shipment_route"],
      risk_flag_status: ["open", "ack", "resolved"],
      severity: ["low", "med", "high", "unknown"],
      shipment_status: ["in_transit", "delivered", "delayed"],
      signal_source: ["weather", "news"],
      signal_status: ["active", "stale", "degraded", "resolved"],
      tick_mode: ["live", "replay"],
      tick_trigger_source: ["cron", "manual", "inject", "replay"],
    },
  },
} as const;
