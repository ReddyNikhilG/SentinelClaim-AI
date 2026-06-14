import { CheckSquare, XSquare, AlertTriangle, UserCheck } from 'lucide-react';
import type { ActionConfig } from './types';

export const ACTION_CONFIG: Record<string, ActionConfig> = {
  bulk_approved: { icon: CheckSquare, label: 'Bulk Approve', color: 'text-success', bgColor: 'bg-success/10' },
  bulk_rejected: { icon: XSquare, label: 'Bulk Reject', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  bulk_siu_investigation: { icon: AlertTriangle, label: 'Bulk Escalate to SIU', color: 'text-warning', bgColor: 'bg-warning/10' },
  bulk_reassign: { icon: UserCheck, label: 'Bulk Reassign', color: 'text-primary', bgColor: 'bg-primary/10' },
};

export const ITEMS_PER_PAGE = 15;
