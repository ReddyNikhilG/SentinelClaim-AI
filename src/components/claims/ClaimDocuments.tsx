import React, { useRef, useState } from 'react';
import { useClaimDocuments } from '@/hooks/useClaimDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Loader2,
  File,
  Image,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClaimDocumentsProps {
  claimId: string;
}

export function ClaimDocuments({ claimId }: ClaimDocumentsProps) {
  const { 
    documents, 
    isLoading, 
    uploadDocument, 
    isUploading, 
    deleteDocument, 
    isDeleting,
    getDownloadUrl 
  } = useClaimDocuments(claimId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file);
      e.target.value = ''; // Reset input
    }
  };

  const handleDownload = async (doc: { id: string; file_path: string; file_name: string }) => {
    setDownloadingId(doc.id);
    try {
      const url = await getDownloadUrl(doc.file_path);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.file_name;
        link.click();
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-5 w-5" />;
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5 text-info" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) 
      return <FileSpreadsheet className="h-5 w-5 text-success" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-destructive" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="card-enterprise">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          Documents & Evidence
        </CardTitle>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No documents uploaded yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Upload PDFs, images, or spreadsheets as evidence
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.file_type)}
                  <div>
                    <p className="font-medium text-sm truncate max-w-[200px]">
                      {doc.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteDocument(doc)}
                    disabled={isDeleting}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
