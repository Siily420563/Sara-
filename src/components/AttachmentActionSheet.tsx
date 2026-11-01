import React from 'react';
import { Image as ImageIcon, FileText, Camera, Sparkles, X, FileUp } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhotos: () => void;
  onSelectDocuments?: () => void;
  onSelectDocument?: () => void;
  onSelectCamera: () => void;
  onOpenImageGen: () => void;
  saraName?: string;
}

export default function AttachmentActionSheet({
  isOpen,
  onClose,
  onSelectPhotos,
  onSelectDocuments,
  onSelectDocument,
  onSelectCamera,
  onOpenImageGen,
  saraName = 'SARA'
}: Props) {
  if (!isOpen) return null;

  const handleDocClick = () => {
    onClose();
    if (onSelectDocuments) onSelectDocuments();
    else if (onSelectDocument) onSelectDocument();
  };

  return (
    <div 
      id="attachment-menu-backdrop"
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="attachment-menu-panel"
        className="w-full sm:max-w-md bg-[#0B131F] border-t sm:border border-[#1E334D] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-[#142336]">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <FileUp size={16} className="text-cyan-400" />
              Send File or Generate
            </h3>
            <p className="text-[11px] text-[#4889A1]">
              Photo bhejna hai ya PDF document analysis karwana hai?
            </p>
          </div>
          <button 
            id="close-attachment-sheet"
            type="button" 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-[#162A40] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Photos / Gallery */}
          <button
            id="attach-photos-btn"
            type="button"
            onClick={() => {
              onClose();
              onSelectPhotos();
            }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#0F1A2A] hover:bg-[#15253C] border border-[#1E3550] hover:border-indigo-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-indigo-600/30 transition-transform">
              <ImageIcon size={24} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
              Photos & Gallery
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              Images & Screenshots
            </span>
          </button>

          {/* PDF & Documents */}
          <button
            id="attach-documents-btn"
            type="button"
            onClick={handleDocClick}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#0F1A2A] hover:bg-[#15253C] border border-[#1E3550] hover:border-rose-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-rose-600/30 transition-transform">
              <FileText size={24} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
              PDF & Documents
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              Full PDF & File Analysis
            </span>
          </button>

          {/* Camera */}
          <button
            id="attach-camera-btn"
            type="button"
            onClick={() => {
              onClose();
              onSelectCamera();
            }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#0F1A2A] hover:bg-[#15253C] border border-[#1E3550] hover:border-cyan-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-cyan-600/30 transition-transform">
              <Camera size={24} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
              Camera Vision
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              Real-time Photo Capture
            </span>
          </button>

          {/* AI Image Generation */}
          <button
            id="attach-imggen-btn"
            type="button"
            onClick={() => {
              onClose();
              onOpenImageGen();
            }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#0F1A2A] hover:bg-[#15253C] border border-[#1E3550] hover:border-purple-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-purple-600/30 transition-transform">
              <Sparkles size={24} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
              AI Image Generator
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              Create picture via prompt
            </span>
          </button>
        </div>

        {/* Footer tip */}
        <div className="pt-2 text-center text-[10px] text-gray-500">
          Powered by latest Gemini 3.8 Flash & Imagen 3 models
        </div>
      </div>
    </div>
  );
}
