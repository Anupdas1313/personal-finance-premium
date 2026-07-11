import React, { useState, useEffect } from 'react';
import { Download, Share, X, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function PwaInstallPromoter() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isWebView, setIsWebView] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [guideType, setGuideType] = useState<'webview' | 'ios' | 'android' | null>(null);

  useEffect(() => {
    // Check if running in standalone (installed) mode
    const standaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true;
    setIsStandalone(standaloneMode);

    // Detect WebView / In-App Browser (WhatsApp, Instagram, FB, etc.)
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isWv = /FBAN|FBAV|Instagram|Twitter|Pinterest|Line|FB_IAB|Messenger|WhatsApp|GSA|WebView|wv/i.test(userAgent) ||
                 (userAgent.includes('iPhone') && !userAgent.includes('Safari') && !userAgent.includes('CriOS'));
    setIsWebView(isWv);

    // Detect iOS
    const iosDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(iosDevice);

    // If already installed, don't listen to prompts
    if (standaloneMode) return;

    // Listen to standard Chrome PWA install trigger
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-show banner if in standard browser and not installed
      if (!isWv) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Fallback: If not standalone, not webview, and is iOS, show iOS prompt after a slight delay
    if (!standaloneMode && !isWv && iosDevice) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Fallback: If inside WebView (like WhatsApp), show instruction immediately
    if (isWv && !standaloneMode) {
      setShowPrompt(true);
      setGuideType('webview');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isWebView) {
      setGuideType('webview');
      return;
    }

    if (isIOS) {
      setGuideType('ios');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback guide if deferredPrompt is not available (e.g. Firefox, secondary browsers)
      setGuideType('android');
    }
  };

  if (isStandalone) return null;
  if (!showPrompt) return null;

  return (
    <>
      {/* Sticky Top Banner */}
      <div className="fixed top-0 inset-x-0 z-[200] p-4 bg-brand-blue text-white shadow-xl animate-slide-in-from-top">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              {isWebView ? (
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              ) : (
                <Download className="w-5 h-5 text-brand-green" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider leading-none mb-1">
                {isWebView ? 'In-App Browser Detected' : 'Install Expensify App'}
              </p>
              <p className="text-[9px] text-white/80 leading-tight">
                {isWebView 
                  ? 'WhatsApp doesn\'t support installation. Open this link in Chrome or Safari to install the app!' 
                  : 'Install Expensify to your Home Screen for full offline support and a native app experience.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 bg-brand-green text-white dark:text-brand-blue text-[9px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all"
            >
              {isWebView ? 'Show Guide' : 'Install'}
            </button>
            <button 
              onClick={() => setShowPrompt(false)} 
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Guide Modals */}
      {guideType && (
        <div className="fixed inset-0 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[210] animate-fade-in" onClick={() => setGuideType(null)}>
          <div 
            className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-2xl p-6 max-w-sm w-full mx-4 animate-scale-up text-brand-blue dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-50 dark:border-white/5">
              <h3 className="text-xs font-heading font-black uppercase tracking-widest">
                {guideType === 'webview' ? 'How to Open in Browser' : 'Installation Guide'}
              </h3>
              <button 
                onClick={() => setGuideType(null)} 
                className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 hover:text-brand-red uppercase tracking-wider"
              >
                Close
              </button>
            </div>

            {guideType === 'webview' && (
              <div className="space-y-4">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  You opened this link inside <strong>WhatsApp</strong>. WhatsApp's internal browser prevents app installations. Follow these simple steps to install:
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Tap the <strong>three dots menu (⋮)</strong> or <strong>Share icon</strong> in the top-right corner of the WhatsApp browser screen.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Select <strong>"Open in Chrome"</strong>, <strong>"Open in Safari"</strong>, or <strong>"Open in Browser"</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Once it loads in your main browser, you will see a banner to install it directly to your phone's Home Screen!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {guideType === 'ios' && (
              <div className="space-y-4">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  iOS devices require manual installation through Safari. Follow these steps:
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                      Tap the <strong>Share button</strong> <Share className="w-3.5 h-3.5 inline text-brand-blue dark:text-white" /> in Safari's bottom toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Scroll down the options list and select <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Tap <strong>"Add"</strong> in the top-right corner to complete the installation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {guideType === 'android' && (
              <div className="space-y-4">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Follow these steps to manually install the app using your browser menu:
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Tap the browser's <strong>menu icon (⋮)</strong> located at the top-right.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                    <p className="text-[9px] font-medium leading-normal mt-0.5">
                      Confirm the installation dialog to add the app icon to your phone.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setGuideType(null)}
              className="mt-6 w-full py-2 bg-brand-green text-white dark:text-brand-blue rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-brand-green/10"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
