import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Upload, 
  X, 
  File,
  Image,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewClaimDocumentsProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  isUploading?: boolean;
}

export function NewClaimDocuments({ files, onFilesChange, isUploading }: NewClaimDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      onFilesChange([...files, ...selectedFiles]);
      e.target.value = ''; // Reset input
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesChange([...files, ...droppedFiles]);
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-5 w-5 text-info" />;
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) 
      return <FileSpreadsheet className="h-5 w-5 text-success" />;
    if (file.type.includes('pdf')) return <FileText className="h-5 w-5 text-destructive" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          Documents & Evidence
        </CardTitle>
        <CardDescription>
          Upload supporting documents (photos, police reports, estimates, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.heic,.webp"
          />
          {isUploading ? (
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
          ) : (
            <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          )}
          <p className="text-sm font-medium text-foreground">
            {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOC, XLS, JPG, PNG up to 10MB each
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {getFileIcon(file)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
