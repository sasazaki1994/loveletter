'use client';

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BarcodeFormat = string;
type BarcodeDetection = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: CanvasImageSource | HTMLVideoElement | ImageBitmap) => Promise<BarcodeDetection[]>;
};
type BarcodeDetectorCtor = {
  new (options?: { formats?: BarcodeFormat[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<BarcodeFormat[]>;
};
declare const BarcodeDetector: BarcodeDetectorCtor;

type RoomQrScannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
};

export function RoomQrScanner({ open, onOpenChange, onDetected }: RoomQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // テスト環境用フック: E2Eから強制検出を呼び出せるようにする
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    const handler = (value: string) => onDetected(value);
    (window as any).__llrTestTriggerQr = handler;
    return () => {
      if ((window as any).__llrTestTriggerQr === handler) {
        delete (window as any).__llrTestTriggerQr;
      }
    };
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;

    let frameId: number | null = null;
    let stream: MediaStream | null = null;
    let detector: BarcodeDetectorInstance | null = null;
    let active = true;

    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const scan = async () => {
      if (!active || !detector || !videoRef.current) return;
      try {
        const codes: BarcodeDetection[] = await detector.detect(videoRef.current);
        const hit = codes.find((c) => c.rawValue);
        if (hit?.rawValue) {
          stop();
          onDetected(hit.rawValue);
          return;
        }
      } catch (err) {
        console.error("QR detect failed", err);
      }
      frameId = requestAnimationFrame(scan);
    };

    const start = async () => {
      setError(null);
      setStarting(true);
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        setError("ブラウザ環境でのみ利用できます。");
        setStarting(false);
        return;
      }

      const DetectorCtor = (window as any).BarcodeDetector as typeof BarcodeDetector | undefined;
      if (!DetectorCtor) {
        setError("このブラウザはQRコード読み取りに対応していません。Chrome/Edgeを利用してください。");
        setStarting(false);
        return;
      }

      const supported = (await DetectorCtor.getSupportedFormats?.()) ?? [];
      if (supported.length > 0 && !supported.includes("qr_code")) {
        setError("QRコード検出に未対応の環境です。");
        setStarting(false);
        return;
      }

      detector = new DetectorCtor({ formats: ["qr_code"] as BarcodeFormat[] });

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err) {
        console.error("getUserMedia failed", err);
        setError("カメラにアクセスできません。権限や他アプリの使用状況を確認してください。");
        setStarting(false);
        return;
      }

      if (!active) {
        stop();
        return;
      }

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => undefined);
      }

      setStarting(false);
      frameId = requestAnimationFrame(scan);
    };

    start();

    return () => {
      active = false;
      stop();
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QRコードで入室
          </DialogTitle>
          <DialogDescription>カメラにQRコードを映してルームIDを自動入力します。</DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-[rgba(215,178,110,0.35)] bg-[rgba(12,32,30,0.45)] p-3 text-sm text-[var(--color-warn-light)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-[rgba(215,178,110,0.2)] bg-[rgba(8,18,18,0.7)]">
              <video
                ref={videoRef}
                className="aspect-square w-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <div className="pointer-events-none absolute inset-0 border border-[rgba(215,178,110,0.4)]" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(9,18,18,0.55)]">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent-light)]" />
                </div>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              外側カメラを優先します。読み取りに失敗する場合は距離や明るさを調整してください。
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



