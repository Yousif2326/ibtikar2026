'use client';

import * as React from 'react';
import { ImageCapture } from '@/components/image-capture';
import { OcrReview } from '@/components/ocr-review';
import { TrialResults } from '@/components/trial-results';
import { InactivityGuard } from '@/components/inactivity-guard';
import { uploadForOCR, matchTrials } from '@/lib/api';
import type { MatchResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  IconLogout,
  IconArrowLeft,
  IconStethoscope,
} from '@tabler/icons-react';

type Step = 'capture' | 'review' | 'results';

interface DashboardClientProps {
  user: { firstName: string; lastName: string; email: string };
  signOutAction: () => Promise<void>;
}

export function DashboardClient({ user, signOutAction }: DashboardClientProps) {
  const [step, setStep] = React.useState<Step>('capture');
  const [ocrText, setOcrText] = React.useState('');
  const [matchResponse, setMatchResponse] = React.useState<MatchResponse | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleImageCaptured = async (file: File | Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await uploadForOCR(file);
      setOcrText(result.extracted_text);
      setStep('review');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'OCR processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatchTrials = async (editedText: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await matchTrials(editedText);
      setMatchResponse(result);
      setStep('results');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Treatment trial matching failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('capture');
    setOcrText('');
    setMatchResponse(null);
    setError(null);
  };

  return (
    <InactivityGuard timeoutMinutes={15} onTimeout={signOutAction}>
      <div className="min-h-dvh bg-background">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
          <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-3 sm:h-14 sm:px-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <IconStethoscope className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-xs font-semibold sm:text-sm">Treatment Trial Match</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <span className="hidden text-xs text-muted-foreground xs:inline sm:inline">
                {user.firstName} {user.lastName}
              </span>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit" className="h-8 px-2 sm:h-9 sm:px-3">
                  <IconLogout className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </form>
            </div>
          </div>
        </header>

        {/* Progress indicator */}
        <div className="mx-auto max-w-5xl px-3 pt-4 sm:px-4 sm:pt-6">
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground sm:mb-6 sm:justify-start sm:gap-2">
            <StepIndicator label="1. Capture" active={step === 'capture'} done={step !== 'capture'} />
            <div className="h-px w-4 bg-border sm:w-6" />
            <StepIndicator label="2. Review" active={step === 'review'} done={step === 'results'} />
            <div className="h-px w-4 bg-border sm:w-6" />
            <StepIndicator label="3. Results" active={step === 'results'} done={false} />
          </div>

          {/* Back button */}
          {step !== 'capture' && (
            <button
              onClick={step === 'review' ? handleReset : () => setStep('review')}
              className="mb-4 inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground active:bg-muted"
            >
              <IconArrowLeft className="h-3 w-3" />
              {step === 'review' ? 'Back to capture' : 'Back to review'}
            </button>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive sm:px-4 sm:py-3 sm:text-sm">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Step content */}
          {step === 'capture' && (
            <ImageCapture
              onImageCaptured={handleImageCaptured}
              isProcessing={isProcessing}
            />
          )}

          {step === 'review' && (
            <OcrReview
              ocrText={ocrText}
              onSubmit={handleMatchTrials}
              isProcessing={isProcessing}
            />
          )}

          {step === 'results' && matchResponse && (
            <TrialResults
              response={matchResponse}
              onNewSearch={handleReset}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t px-3 py-4 sm:mt-12 sm:px-4">
          <p className="text-center text-[11px] text-muted-foreground sm:text-xs">
            All patient data is processed ephemerally and never stored. Not HIPAA compliant yet.
          </p>
        </footer>
      </div>
    </InactivityGuard>
  );
}

function StepIndicator({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-primary/10 text-primary'
          : done
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground'
      }`}
    >
      {done ? (
        <svg className="mr-1 h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {label}
    </span>
  );
}
