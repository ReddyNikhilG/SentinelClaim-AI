import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Loader2, Trash2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ClaimNoteRow = Database['public']['Tables']['claim_notes']['Row'];

interface ClaimNotesProps {
  claimId: string;
}

export function ClaimNotes({ claimId }: ClaimNotesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'comment' | 'internal'>('comment');

  const { data: notes = [], isLoading } = useQuery<ClaimNoteRow[]>({
    queryKey: ['claim_notes', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_notes')
        .select<ClaimNoteRow>('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!claimId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newNote.trim()) throw new Error('Missing data');
      const { error } = await supabase.from('claim_notes').insert({
        claim_id: claimId,
        user_id: user.id,
        content: newNote.trim(),
        note_type: noteType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim_notes', claimId] });
      setNewNote('');
      toast({ title: 'Note Added', description: 'Your note has been saved.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('claim_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim_notes', claimId] });
    },
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-accent" />
          Notes & Comments
          <Badge variant="secondary" className="ml-auto">{notes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={noteType === 'comment' ? 'default' : 'outline'}
              onClick={() => setNoteType('comment')}
            >
              Comment
            </Button>
            <Button
              type="button"
              size="sm"
              variant={noteType === 'internal' ? 'default' : 'outline'}
              onClick={() => setNoteType('internal')}
            >
              Internal Note
            </Button>
          </div>
          <Textarea
            placeholder={noteType === 'internal' ? 'Add an internal note (visible to team only)...' : 'Add a comment...'}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => addNoteMutation.mutate()}
              disabled={!newNote.trim() || addNoteMutation.isPending}
              size="sm"
            >
              {addNoteMutation.isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-2 h-3 w-3" />
              )}
              Add Note
            </Button>
          </div>
        </div>

        {/* Notes list */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No notes yet. Add one above.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-lg border ${
                  note.note_type === 'internal' ? 'bg-warning/5 border-warning/20' : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                    {note.note_type === 'internal' && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-warning/30">
                        Internal
                      </Badge>
                    )}
                  </div>
                  {note.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
