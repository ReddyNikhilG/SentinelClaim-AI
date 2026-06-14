import React, { useState, useCallback } from 'react';
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { ClaimFormData, ClaimType } from '@/types/claims';
import { cn } from '@/lib/utils';
import { useElevenLabsTranscribe } from '@/hooks/useElevenLabsTranscribe';

interface VoiceClaimInputProps {
  onFormDataExtracted: (data: Partial<ClaimFormData>) => void;
}

export function VoiceClaimInput({ onFormDataExtracted }: VoiceClaimInputProps) {
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isFillingForm, setIsFillingForm] = useState(false);

  const {
    isRecording,
    isTranscribing,
    transcript,
    error: transcribeError,
    startRecording,
    stopRecording,
  } = useElevenLabsTranscribe();

  const errorMessage = processingError || transcribeError;
  const isProcessing = isTranscribing || isFillingForm;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const invokeParseVoiceClaim = useCallback(async (value: string) => {
    const retryDelays = [700, 1400, 2500];
    let lastError: unknown = null;

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      const { data, error: functionError } = await supabase.functions.invoke('parse-voice-claim', {
        body: { transcript: value }
      });

      if (!functionError && !data?.error) {
        return data;
      }

      lastError = functionError || new Error(data?.error || 'Unknown parser error');
      const message = (functionError?.message || data?.error || '').toLowerCase();
      const shouldRetry = message.includes('429') || message.includes('rate limit') || message.includes('non-2xx');

      if (!shouldRetry || attempt === retryDelays.length - 1) {
        break;
      }

      await wait(retryDelays[attempt]);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Voice parser request failed. Please try again.');
  }, []);

  const processTranscript = useCallback(async () => {
    if (!transcript.trim()) {
      setProcessingError('No speech detected yet. Please record again and speak clearly for 3–5 seconds.');
      return;
    }

    setIsFillingForm(true);
    setProcessingError(null);
    setSuccess(null);

    try {
      const data = await invokeParseVoiceClaim(transcript.trim());

      const extractedData = data.data;
      
      if (!extractedData || Object.keys(extractedData).length === 0) {
        setProcessingError('Could not extract claim information from your voice input. Please try again with more details.');
        return;
      }

      // Validate and normalize claim_type
      const validClaimTypes: ClaimType[] = ['auto', 'property', 'liability', 'workers_comp', 'health'];
      if (extractedData.claim_type && !validClaimTypes.includes(extractedData.claim_type)) {
        delete extractedData.claim_type;
      }

      // Convert claim_amount to string if needed
      if (extractedData.claim_amount && typeof extractedData.claim_amount === 'number') {
        extractedData.claim_amount = extractedData.claim_amount.toString();
      }

      onFormDataExtracted(extractedData);

      const fieldsExtracted = Object.keys(extractedData).length;
      const warningSuffix = data.warning ? ' (Used fallback parsing due to temporary AI limits.)' : '';
      setSuccess(`Successfully extracted ${fieldsExtracted} field${fieldsExtracted > 1 ? 's' : ''} from your voice input!${warningSuffix}`);
    } catch (err) {
      console.error('Failed to process transcript:', err);
      const message = err instanceof Error ? err.message : 'Failed to process voice input.';
      const friendly = message.toLowerCase().includes('non-2xx') || message.toLowerCase().includes('rate limit')
        ? 'Voice processing is temporarily busy. Please wait a few seconds and tap Fill Form again.'
        : message;
      setProcessingError(friendly);
    } finally {
      setIsFillingForm(false);
    }
  }, [transcript, onFormDataExtracted, invokeParseVoiceClaim]);

  const handleToggleListening = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      setSuccess(null);
      setProcessingError(null);
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-accent" />
          Voice Claim Entry
        </CardTitle>
        <CardDescription>
          Describe your claim incident using voice. Include details like claim type, date, location, amount, and your contact information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Control */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="lg"
            onClick={handleToggleListening}
            disabled={isProcessing}
            className={cn(
              "w-full sm:w-auto gap-2 transition-all",
              isRecording && "animate-pulse"
            )}
          >
            {isRecording ? (
              <>
                <MicOff className="h-5 w-5" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Start Recording
              </>
            )}
          </Button>

          {transcript && !isRecording && (
            <Button
              type="button"
              onClick={processTranscript}
              disabled={isProcessing}
              className="w-full sm:w-auto gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isTranscribing ? "Transcribing..." : "Filling form..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Fill Form
                </>
              )}
            </Button>
          )}
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse delay-75" />
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse delay-150" />
            </div>
            <span>Listening... Speak clearly about your claim</span>
          </div>
        )}

        {/* Transcribing indicator */}
        {isTranscribing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Transcribing audio…</span>
          </div>
        )}

        {/* Transcript Display */}
        {transcript && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transcript</p>
            <p className="text-sm">{transcript}</p>
          </div>
        )}

        {/* Example Prompt */}
        {!transcript && !isRecording && !isTranscribing && (
          <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Example voice input:</p>
            <p className="text-sm text-muted-foreground italic">
              "I need to file an auto claim. My name is John Smith, email john@example.com, phone 555-123-4567. 
              Yesterday at 123 Main Street, my car was hit by another vehicle. The damage is estimated at $5,000. 
              My policy number is POL-123456."
            </p>
          </div>
        )}

        {/* Status Messages */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-accent/40 bg-accent/10">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

