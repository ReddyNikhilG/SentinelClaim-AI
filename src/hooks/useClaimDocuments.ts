import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ClaimDocument {
  id: string;
  claim_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useClaimDocuments(claimId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['claim-documents', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_documents')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ClaimDocument[];
    },
    enabled: !!claimId && !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${claimId}/${Date.now()}-${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('claim-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create record in claim_documents table
      const { data, error: insertError } = await supabase
        .from('claim_documents')
        .insert({
          claim_id: claimId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-documents', claimId] });
      toast({
        title: 'Document Uploaded',
        description: 'The file has been uploaded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (document: ClaimDocument) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('claim-documents')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: dbError } = await supabase
        .from('claim_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-documents', claimId] });
      toast({
        title: 'Document Deleted',
        description: 'The file has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('claim-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return data?.signedUrl;
  };

  return {
    documents,
    isLoading,
    uploadDocument: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    deleteDocument: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    getDownloadUrl,
  };
}
