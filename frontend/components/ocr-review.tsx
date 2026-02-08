'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { IconSearch, IconLoader2, IconEdit } from '@tabler/icons-react';

interface OcrReviewProps {
  ocrText: string;
  onSubmit: (editedText: string) => void;
  isProcessing: boolean;
}

export function OcrReview({ ocrText, onSubmit, isProcessing }: OcrReviewProps) {
  const [text, setText] = React.useState(ocrText);
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    setText(ocrText);
  }, [ocrText]);

  const handleSubmit = () => {
    if (text.trim().length === 0) return;
    onSubmit(text);
  };

  if (isProcessing) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Matching clinical trials...
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Analyzing patient criteria and searching 70,000+ trials.
            This may take 10-20 seconds.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg">Review Extracted Text</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          The OCR engine extracted the following text from the uploaded document.
          Please review for accuracy. You can edit any errors before proceeding.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {isEditing ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[200px] font-mono text-xs sm:min-h-[250px] sm:text-sm"
            placeholder="Patient information..."
          />
        ) : (
          <div className="max-h-[300px] overflow-y-auto rounded-lg border bg-muted/30 p-3 sm:max-h-[400px] sm:p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground sm:text-sm">
              {text || '(No text extracted. Please go back and try a different image.)'}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 px-4 sm:flex-row sm:justify-between sm:px-6">
        <Button
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
          className="h-11 w-full sm:h-10 sm:w-auto"
        >
          <IconEdit className="h-4 w-4" />
          {isEditing ? 'Preview' : 'Edit Text'}
        </Button>
        <Button onClick={handleSubmit} disabled={!text.trim()} className="h-11 w-full sm:h-10 sm:w-auto">
          <IconSearch className="h-4 w-4" />
          Find Matching Trials
        </Button>
      </CardFooter>
    </Card>
  );
}
