import React, { useState } from 'react';
import { Sparkles, X, Image as ImageIcon, Download, Send, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  onSendToChat?: (prompt: string, imageUrl: string) => void;
  onInsertImage?: (prompt: string, imageUrl: string) => void;
  customApiKey?: string;
  saraName?: string;
}

const SAMPLE_PROMPTS = [
  "Cyberpunk Mumbai street at night with glowing neon signs and rain",
  "Futuristic AI assistant hologram floating inside a modern glass apartment",
  "Cute robotic cat sipping chai in space with Earth in the background",
  "Majestic snow-capped Himalayan peaks during golden hour sunset"
];

export default function ImageGenModal({
  isOpen = true,
  onClose,
  onSendToChat,
  onInsertImage,
  customApiKey,
  saraName = 'SARA'
}: Props) {
  if (!isOpen) return null;

  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async (targetPrompt?: string) => {
    const finalPrompt = (targetPrompt || prompt).trim();
    if (!finalPrompt) return;

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          aspectRatio,
          customApiKey
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Image generation failed. Please try again.');
      }

      setGeneratedImage(data.imageUrl);
      setUsedModel(data.model || 'imagen-3.0-generate-002');
    } catch (err: any) {
      console.error('Image generation error:', err);
      setErrorMsg(err.message || 'Image generation failed. Settings mein API key verify karein.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertIntoChat = () => {
    if (!generatedImage) return;
    if (onInsertImage) {
      onInsertImage(prompt || 'Generated AI Artwork', generatedImage);
    } else if (onSendToChat) {
      onSendToChat(prompt || 'Generated AI Artwork', generatedImage);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div 
        id="image-gen-modal"
        className="bg-[#0B111A] border border-[#1C2D42] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#162A40] flex items-center justify-between bg-[#080D14]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                Generate AI Image
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-600/40 text-purple-300">
                  Google Imagen 3
                </span>
              </h2>
              <p className="text-[11px] text-[#4889A1]">
                Koi bhi image describe karein, {saraName} generate kar degi
              </p>
            </div>
          </div>
          <button 
            id="close-image-modal"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#162A40] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Prompt input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">
              Prompt (Describe what you want to see):
            </label>
            <textarea
              id="image-prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A futuristic neon flying car zooming across Cyberpunk Mumbai..."
              rows={3}
              className="w-full bg-[#070D16] border border-[#1F334D] rounded-xl p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
          </div>

          {/* Quick suggestions */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-[#4889A1] uppercase tracking-wider">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                    handleGenerate(p);
                  }}
                  className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-[#0F1724] border border-[#162A40] text-gray-300 hover:text-purple-300 hover:border-purple-500/40 hover:bg-[#151F30] transition-all"
                >
                  "{p.slice(0, 38)}..."
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">
              Aspect Ratio:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '1:1', label: '1:1 Square' },
                { id: '16:9', label: '16:9 Wide' },
                { id: '9:16', label: '9:16 Portrait' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAspectRatio(item.id as any)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    aspectRatio === item.id
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30'
                      : 'bg-[#0D1522] text-gray-300 border-[#1B2D44] hover:bg-[#132032]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result preview */}
          {generatedImage && (
            <div className="p-3 rounded-xl bg-[#070D16] border border-purple-500/40 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span className="text-purple-300 font-semibold flex items-center gap-1">
                  <Sparkles size={12} /> Image Ready
                </span>
                <span className="text-[10px] text-gray-400 font-mono">Model: {usedModel}</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-[#162A40] bg-black/40 flex items-center justify-center">
                <img
                  src={generatedImage}
                  alt={prompt || 'AI generated art'}
                  className="max-h-72 w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInsertIntoChat}
                  className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                  <Send size={14} />
                  Chat me add karein
                </button>
                <a
                  href={generatedImage}
                  download="sara-image.jpg"
                  className="py-2 px-3 rounded-xl bg-[#142033] hover:bg-[#1C2C46] border border-[#233A54] text-gray-200 text-xs font-medium flex items-center justify-center gap-1 transition-all"
                  title="Download Image"
                >
                  <Download size={14} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#162A40] bg-[#080D14] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-[#1F334D] text-gray-300 text-xs font-semibold hover:bg-[#142033] transition-all"
          >
            Cancel
          </button>
          <button
            id="start-generate-image-btn"
            type="button"
            disabled={isGenerating || !prompt.trim()}
            onClick={() => handleGenerate()}
            className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/40 transition-all"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate Image
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
