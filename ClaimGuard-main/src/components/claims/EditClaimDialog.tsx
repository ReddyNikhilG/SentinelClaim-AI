import React, { useState, useEffect } from 'react';
import { Claim, ClaimFormData, ClaimType } from '@/types/claims';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';

interface EditClaimDialogProps {
  claim: Claim;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Claim>) => void;
  isSaving: boolean;
}

export function EditClaimDialog({
  claim,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: EditClaimDialogProps) {
  const [formData, setFormData] = useState({
    policy_number: claim.policy_number,
    claim_type: claim.claim_type,
    claim_amount: claim.claim_amount.toString(),
    incident_date: claim.incident_date,
    incident_location: claim.incident_location,
    description: claim.description || '',
    claimant_name: claim.claimant_name,
    claimant_email: claim.claimant_email || '',
    claimant_phone: claim.claimant_phone || '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        policy_number: claim.policy_number,
        claim_type: claim.claim_type,
        claim_amount: claim.claim_amount.toString(),
        incident_date: claim.incident_date,
        incident_location: claim.incident_location,
        description: claim.description || '',
        claimant_name: claim.claimant_name,
        claimant_email: claim.claimant_email || '',
        claimant_phone: claim.claimant_phone || '',
      });
    }
  }, [claim, open]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: Partial<Claim> = {
      policy_number: formData.policy_number,
      claim_type: formData.claim_type as ClaimType,
      claim_amount: parseFloat(formData.claim_amount),
      incident_date: formData.incident_date,
      incident_location: formData.incident_location,
      description: formData.description || null,
      claimant_name: formData.claimant_name,
      claimant_email: formData.claimant_email || null,
      claimant_phone: formData.claimant_phone || null,
    };

    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Claim {claim.claim_number}</DialogTitle>
          <DialogDescription>
            Modify the claim details below. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_policy_number">Policy Number</Label>
              <Input
                id="edit_policy_number"
                name="policy_number"
                value={formData.policy_number}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_claim_type">Claim Type</Label>
              <Select
                value={formData.claim_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, claim_type: value as ClaimType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="workers_comp">Workers Comp</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_claim_amount">Claim Amount ($)</Label>
              <Input
                id="edit_claim_amount"
                name="claim_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.claim_amount}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_incident_date">Incident Date</Label>
              <Input
                id="edit_incident_date"
                name="incident_date"
                type="date"
                value={formData.incident_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_incident_location">Incident Location</Label>
            <Input
              id="edit_incident_location"
              name="incident_location"
              value={formData.incident_location}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_description">Description</Label>
            <Textarea
              id="edit_description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_claimant_name">Claimant Name</Label>
            <Input
              id="edit_claimant_name"
              name="claimant_name"
              value={formData.claimant_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_claimant_email">Email</Label>
              <Input
                id="edit_claimant_email"
                name="claimant_email"
                type="email"
                value={formData.claimant_email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_claimant_phone">Phone</Label>
              <Input
                id="edit_claimant_phone"
                name="claimant_phone"
                type="tel"
                value={formData.claimant_phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
