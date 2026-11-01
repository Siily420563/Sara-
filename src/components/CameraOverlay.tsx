import React, { useEffect, useRef } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

interface Props {
  onCapture: (attachment: { mimeType: string, data: string, url: string }) => void;
  onClose: () => void;
}

export default function CameraOverlay({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setErrorMsg(null);
    const startCamera = async () => {
      // Stop previous stream if switching
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode } 
        });
        if (active) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (err: any) {
        console.warn("Camera failed:", err);
        if (active) {
          setErrorMsg(err?.message?.includes('Permission') 
            ? 'Camera permission denied. If previewing inside an iframe, please open the app in a new tab to grant camera access.'
            : 'Could not access device camera. Please check your camera settings.');
        }
      }
    };
    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const [prefix, base64] = dataUrl.split(',');
    
    onCapture({ mimeType: 'image/jpeg', data: base64, url: dataUrl });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center">
        {errorMsg ? (
          <div className="p-6 max-w-sm mx-auto text-center bg-[#0F1724] border border-red-500/40 rounded-2xl text-red-200">
            <p className="text-sm leading-relaxed mb-4">{errorMsg}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold"
            >
              Close Camera
            </button>
          </div>
        ) : (
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            className="max-h-full max-w-full object-contain"
          />
        )}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-gray-800/80 p-2 rounded-full text-white"
        >
          <X size={24} />
        </button>
      </div>
      <div className="h-32 bg-black flex items-center justify-center pb-8 relative">
        <button 
          onClick={handleCapture}
          className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Camera size={24} className="text-black" />
        </button>
        <button 
          onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
          className="absolute right-8 top-1/2 -translate-y-1/2 -mt-4 p-3 bg-gray-800/80 rounded-full text-white hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={24} />
        </button>
      </div>
    </div>
  );
}
