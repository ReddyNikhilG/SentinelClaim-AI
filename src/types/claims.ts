export type ClaimStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'siu_investigation' | 'auto_approved';
export type ClaimType = 'auto' | 'property' | 'liability' | 'workers_comp' | 'health';
export type RiskCategory = 'low' | 'medium' | 'high';
export type UserRole = 'admin' | 'adjuster' | 'siu_analyst';

export interface Claim {
  id: string;
  claim_number: string;
  policy_number: string;
  claim_type: ClaimType;
  claim_amount: number;
  incident_date: string;
  incident_location: string;
  description: string | null;
  status: ClaimStatus;
  risk_score: number;
  risk_category: RiskCategory | null;
  assigned_group: string | null;
  assigned_to: string | null;
  claimant_name: string;
  claimant_email: string | null;
  claimant_phone: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FraudResult {
  id: string;
  claim_id: string;
  score: number;
  category: RiskCategory;
  factors: FraudFactor[];
  analyzed_at: string;
}

export interface FraudFactor {
  name: string;
  weight: number;
  description: string;
}

export interface ClaimEvent {
  id: string;
  claim_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  claim_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

// Form types
export interface ClaimFormData {
  policy_number: string;
  claim_type: ClaimType;
  claim_amount: string;
  incident_date: string;
  incident_location: string;
  description: string;
  claimant_name: string;
  claimant_email: string;
  claimant_phone: string;
}

// Dashboard stats
export interface DashboardStats {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  highRiskClaims: number;
  totalAmount: number;
  avgRiskScore: number;
}
