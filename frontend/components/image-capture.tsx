'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { IconCamera, IconUpload, IconLoader2, IconX } from '@tabler/icons-react';

interface ImageCaptureProps {
  onImageCaptured: (file: File | Blob) => void;
  isProcessing: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]);

export function ImageCapture({ onImageCaptured, isProcessing }: ImageCaptureProps) {
  const [mode, setMode] = React.useState<'select' | 'camera' | 'upload'>('select');
  const [preview, setPreview] = React.useState<string | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Cleanup camera on unmount or mode change
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        'Camera access denied. Please allow camera permissions or use file upload instead.'
      );
      setMode('select');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMode('select');
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setPreview(url);
          stopCamera();
          onImageCaptured(blob);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setCameraError(`Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, or TIFF.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setCameraError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 10 MB.`);
      return;
    }

    setCameraError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageCaptured(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setCameraError(`Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, or TIFF.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setCameraError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 10 MB.`);
      return;
    }

    setCameraError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageCaptured(file);
  };

  // Cleanup preview URLs
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (isProcessing) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Processing image with OCR...
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This may take a few seconds.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Capture Patient Document</CardTitle>
          <CardDescription>
            Take a photo or upload an image of the patient&apos;s information.
            All data is processed in memory and never stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cameraError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {cameraError}
            </div>
          )}

          {mode === 'select' && !preview && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={startCamera}
              >
                <IconCamera className="h-6 w-6" />
                <span>Camera</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => {
                  setMode('upload');
                  fileInputRef.current?.click();
                }}
              >
                <IconUpload className="h-6 w-6" />
                <span>Upload</span>
              </Button>
            </div>
          )}

          {mode === 'camera' && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={captureFrame} className="flex-1">
                  <IconCamera className="h-4 w-4" />
                  Capture
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  <IconX className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mode === 'upload' && !preview && (
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Drag and drop an image here, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPEG, PNG, WebP, TIFF up to 10 MB
              </p>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={preview}
                  alt="Captured document"
                  className="w-full"
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Image sent for OCR processing
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff"
            className="hidden"
            onChange={handleFileChange}
          />

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    </div>
  );
}
