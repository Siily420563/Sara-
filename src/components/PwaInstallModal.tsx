import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Laptop, Apple, CheckCircle2, X, Share2, PlusSquare, MoreVertical } from 'lucide-react';
import { promptPwaInstall, isStandalonePwa, hasDeferredInstallPrompt } from '../services/pwa';

interface Props {
  onClose: () => void;
  saraName?: string;
}

export default function PwaInstallModal({ onClose, saraName = 'SARA' }: Props) {
  const [deviceTab, setDeviceTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandalonePwa());
    setHasPrompt(hasDeferredInstallPrompt());

    // Detect user OS/device
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setDeviceTab('ios');
    } else if (/Android/.test(ua)) {
      setDeviceTab('android');
    } else {
      setDeviceTab('desktop');
    }
  }, []);

  const handleInstallClick = async () => {
    const success = await promptPwaInstall();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#0B111A] border border-[#1E3A5F] rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden text-gray-100">
        
        {/* Header */}
        <div className="p-4 border-b border-[#1E3A5F] bg-[#080D14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Install {saraName} App</h2>
              <p className="text-xs text-gray-400">Add to Home Screen & App Drawer</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#162A40] rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
              <h3 className="text-sm font-semibold text-emerald-300">Already Installed!</h3>
              <p className="text-xs text-gray-300">
                {saraName} is already installed and running in standalone app mode on this device.
              </p>
            </div>
          ) : (
            <>
              {/* Direct Prompt Action */}
              <div className="bg-gradient-to-br from-[#0F1C2E] to-[#0A1422] border border-[#1E3654] p-4 rounded-xl text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#060B14] border border-cyan-500/40 p-1 flex items-center justify-center shadow-lg shadow-cyan-950/50">
                  <img src="/pwa-192x192.png" alt={saraName} className="w-full h-full object-cover rounded-xl" onError={(e) => { (e.target as any).src = '/default-avatar.svg'; }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Install {saraName} for Android, iOS & Desktop</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Full-screen experience, zero lag, background voice calls & offline support.</p>
                </div>
                
                {installSuccess ? (
                  <div className="py-2.5 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> App installed successfully!
                  </div>
                ) : (
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2"
                  >
                    <Download size={15} />
                    {hasPrompt ? 'Install App Now' : 'Add to Home Screen'}
                  </button>
                )}
              </div>

              {/* OS Tabs */}
              <div className="flex border-b border-[#1A2E47] text-xs font-medium">
                <button
                  onClick={() => setDeviceTab('android')}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    deviceTab === 'android'
                      ? 'border-cyan-400 text-cyan-300 font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Smartphone size={14} /> Android
                </button>
                <button
                  onClick={() => setDeviceTab('ios')}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    deviceTab === 'ios'
                      ? 'border-cyan-400 text-cyan-300 font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Apple size={14} /> iPhone / iPad
                </button>
                <button
                  onClick={() => setDeviceTab('desktop')}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    deviceTab === 'desktop'
                      ? 'border-cyan-400 text-cyan-300 font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Laptop size={14} /> PC / Mac
                </button>
              </div>

              {/* Instructions based on Tab */}
              <div className="bg-[#080D14] border border-[#162A40] rounded-xl p-3 text-xs space-y-2.5">
                {deviceTab === 'android' && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                      <p className="text-gray-300">Click the <b>"Install App Now"</b> button above, or tap the <b>Chrome menu (<MoreVertical size={12} className="inline" />)</b> in the top-right.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-gray-300">Tap <b>"Install App"</b> or <b>"Add to Home screen"</b> from the menu.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                      <p className="text-gray-300">Confirm <b>"Install"</b>. {saraName} will appear on your home screen like a native app!</p>
                    </div>
                  </>
                )}

                {deviceTab === 'ios' && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                      <p className="text-gray-300">In <b>Safari</b> browser, tap the <b>Share button (<Share2 size={12} className="inline" />)</b> at the bottom bar.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-gray-300">Scroll down the share sheet and tap <b>"Add to Home Screen" (<PlusSquare size={12} className="inline" />)</b>.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                      <p className="text-gray-300">Tap <b>"Add"</b> in the top-right corner. You're done!</p>
                    </div>
                  </>
                )}

                {deviceTab === 'desktop' && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                      <p className="text-gray-300">In Chrome/Edge, click the <b>Install icon (<Download size={12} className="inline" />)</b> on the right side of the address bar.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-gray-300">Or click the browser menu (⋮) &rarr; <b>"Cast, save, and share"</b> &rarr; <b>"Install SARA AI"</b>.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                      <p className="text-gray-300">Click <b>"Install"</b> to launch {saraName} in its own standalone desktop window.</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1E3A5F] bg-[#080D14] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#14263D] hover:bg-[#1C3656] text-gray-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
