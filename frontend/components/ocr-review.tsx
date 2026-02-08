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
        <CardContent className="flex flex-col items-center justify-center py-16">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Matching clinical trials...
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Analyzing patient criteria and searching 70,000+ trials.
            This may take 10-20 seconds.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Review Extracted Text</CardTitle>
        <CardDescription>
          The OCR engine extracted the following text from the uploaded document.
          Please review for accuracy. You can edit any errors before proceeding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[250px] font-mono text-sm"
            placeholder="Patient information..."
          />
        ) : (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
              {text || '(No text extracted. Please go back and try a different image.)'}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
        >
          <IconEdit className="h-4 w-4" />
          {isEditing ? 'Preview' : 'Edit Text'}
        </Button>
        <Button onClick={handleSubmit} disabled={!text.trim()}>
          <IconSearch className="h-4 w-4" />
          Find Matching Trials
        </Button>
      </CardFooter>
    </Card>
  );
}
