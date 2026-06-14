import React from 'react';

export interface BulkActionEvent {
  id: string;
  claim_id: string;
  event_type: string;
  event_data: {
    action: string;
    affected_claim_ids: string[];
    affected_claim_numbers: string[];
    count: number;
    assigned_to?: string;
    assigned_to_name?: string;
    assigned_group?: string | null;
  };
  performed_by: string | null;
  created_at: string;
}

export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export interface ActionConfig {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
}

export const ACTION_CONFIG: Record<string, ActionConfig> = {};
// Populated in a separate file to avoid circular deps
