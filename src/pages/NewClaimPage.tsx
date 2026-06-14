import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useClaims } from '@/hooks/useClaims';
import { VoiceClaimInput } from '@/components/claims/VoiceClaimInput';
import { NewClaimDocuments } from '@/components/claims/NewClaimDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  User, 
  MapPin, 
  Calendar, 
  DollarSign,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClaimFormData, ClaimType } from '@/types/claims';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const claimSchema = z.object({
  policy_number: z.string().min(1, 'Policy number is required').max(50, 'Policy number too long'),
  claim_type: z.enum(['auto', 'property', 'liability', 'workers_comp', 'health'] as const),
  claim_amount: z.string().min(1, 'Claim amount is required').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Amount must be a positive number'
  ),
  incident_date: z.string().min(1, 'Incident date is required'),
  incident_location: z.string().min(1, 'Incident location is required').max(200, 'Location too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  claimant_name: z.string().min(2, 'Claimant name is required').max(100, 'Name too long'),
  claimant_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  claimant_phone: z.string().max(20, 'Phone number too long').optional().or(z.literal('')),
});

export default function NewClaimPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createClaim, isCreating } = useClaims();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const [formData, setFormData] = useState<ClaimFormData>({
    policy_number: '',
    claim_type: 'auto',
    claim_amount: '',
    incident_date: '',
    incident_location: '',
    description: '',
    claimant_name: '',
    claimant_email: '',
    claimant_phone: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle voice extracted data
  const handleVoiceDataExtracted = useCallback((data: Partial<ClaimFormData>) => {
    setFormData(prev => ({
      ...prev,
      ...data,
    }));
    // Clear any errors for fields that were filled
    const filledFields = Object.keys(data);
    if (filledFields.length > 0) {
      setErrors(prev => {
        const newErrors = { ...prev };
        filledFields.forEach(field => {
          delete newErrors[field];
        });
        return newErrors;
      });
    }
  }, []);

  const uploadFilesToClaim = async (claimId: string) => {
    if (pendingFiles.length === 0 || !user) return;
    
    setIsUploadingFiles(true);
    try {
      for (const file of pendingFiles) {
        const fileName = `${claimId}/${Date.now()}-${file.name}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('claim-documents')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Failed to upload file:', uploadError);
          continue;
        }

        // Create record in claim_documents table
        const { error: insertError } = await supabase
          .from('claim_documents')
          .insert({
            claim_id: claimId,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (insertError) {
          console.error('Failed to create document record:', insertError);
        }
      }
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const result = claimSchema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      createClaim(formData, {
        onSuccess: async (claim) => {
          // Upload pending files to the new claim
          await uploadFilesToClaim(claim.id);
          navigate(`/claims/${claim.id}`);
        },
        onError: (error) => {
          setSubmitError(error.message);
        },
      });
    } catch (error) {
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">File New Claim (FNOL)</h2>
          <p className="text-muted-foreground">
            First Notice of Loss - Submit a new insurance claim for processing
          </p>
        </div>

        {submitError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Voice Input */}
            <VoiceClaimInput onFormDataExtracted={handleVoiceDataExtracted} />

            {/* Policy Information */}
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Policy Information
                </CardTitle>
                <CardDescription>
                  Enter the policy details associated with this claim
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="policy_number">Policy Number *</Label>
                  <Input
                    id="policy_number"
                    name="policy_number"
                    placeholder="e.g., POL-123456"
                    value={formData.policy_number}
                    onChange={handleChange}
                    className={errors.policy_number ? 'border-destructive' : ''}
                  />
                  {errors.policy_number && (
                    <p className="text-sm text-destructive">{errors.policy_number}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claim_type">Claim Type *</Label>
                  <Select
                    value={formData.claim_type}
                    onValueChange={(value) => handleSelectChange('claim_type', value)}
                  >
                    <SelectTrigger className={errors.claim_type ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select claim type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto / Vehicle</SelectItem>
                      <SelectItem value="property">Property</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="workers_comp">Workers Compensation</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.claim_type && (
                    <p className="text-sm text-destructive">{errors.claim_type}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Incident Details */}
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-accent" />
                  Incident Details
                </CardTitle>
                <CardDescription>
                  Provide information about when and where the incident occurred
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="incident_date">Incident Date *</Label>
                    <Input
                      id="incident_date"
                      name="incident_date"
                      type="date"
                      value={formData.incident_date}
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      className={errors.incident_date ? 'border-destructive' : ''}
                    />
                    {errors.incident_date && (
                      <p className="text-sm text-destructive">{errors.incident_date}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claim_amount">Estimated Claim Amount ($) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="claim_amount"
                        name="claim_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.claim_amount}
                        onChange={handleChange}
                        className={`pl-10 ${errors.claim_amount ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {errors.claim_amount && (
                      <p className="text-sm text-destructive">{errors.claim_amount}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident_location">Incident Location *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="incident_location"
                      name="incident_location"
                      placeholder="e.g., 123 Main St, City, State"
                      value={formData.incident_location}
                      onChange={handleChange}
                      className={`pl-10 ${errors.incident_location ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.incident_location && (
                    <p className="text-sm text-destructive">{errors.incident_location}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description of Incident</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Provide a detailed description of what happened..."
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Claimant Information */}
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-accent" />
                  Claimant Information
                </CardTitle>
                <CardDescription>
                  Contact details for the person filing the claim
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="claimant_name">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="claimant_name"
                      name="claimant_name"
                      placeholder="John Smith"
                      value={formData.claimant_name}
                      onChange={handleChange}
                      className={`pl-10 ${errors.claimant_name ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.claimant_name && (
                    <p className="text-sm text-destructive">{errors.claimant_name}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="claimant_email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="claimant_email"
                        name="claimant_email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.claimant_email}
                        onChange={handleChange}
                        className={`pl-10 ${errors.claimant_email ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {errors.claimant_email && (
                      <p className="text-sm text-destructive">{errors.claimant_email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claimant_phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="claimant_phone"
                        name="claimant_phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.claimant_phone}
                        onChange={handleChange}
                        className={`pl-10 ${errors.claimant_phone ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {errors.claimant_phone && (
                      <p className="text-sm text-destructive">{errors.claimant_phone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Upload */}
            <NewClaimDocuments 
              files={pendingFiles} 
              onFilesChange={setPendingFiles}
              isUploading={isUploadingFiles}
            />

            {/* Submit Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/claims')}
                disabled={isCreating || isUploadingFiles}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUploadingFiles} className="w-full sm:w-auto">
                {isCreating || isUploadingFiles ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploadingFiles ? 'Uploading Files...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit Claim
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
