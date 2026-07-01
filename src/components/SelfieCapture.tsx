import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw } from "lucide-react";

type Props = {
  onCapture: (blob: Blob) => void;
};

export function SelfieCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera access denied");
      }
    }
    if (!preview) start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [preview]);

  function snap() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setPreview(URL.createObjectURL(blob));
      onCapture(blob);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }, "image/jpeg", 0.85);
  }

  function retake() {
    setPreview(null);
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-muted aspect-[4/3]">
        {error ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">
            {error}
          </div>
        ) : preview ? (
          <img src={preview} alt="Selfie preview" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {preview ? (
        <Button type="button" variant="outline" className="w-full" onClick={retake}>
          <RefreshCw /> Retake
        </Button>
      ) : (
        <Button type="button" className="w-full" onClick={snap} disabled={!!error}>
          <Camera /> Capture selfie
        </Button>
      )}
    </div>
  );
}
