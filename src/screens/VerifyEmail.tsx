import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowLeft, Send, Sparkles, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function VerifyEmail() {
  const { user, logout, resendVerification, loading } = useAuth();
  const [resent, setResent] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [error, setError] = useState('');

  if (loading) return null;
  
  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified) return <Navigate to="/" replace />;

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    try {
      await resendVerification();
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to resend verification email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex w-16 h-16 bg-white dark:bg-[#1A1A1E] rounded-3xl items-center justify-center shadow-2xl border border-brand-blue/5 dark:border-white/5 rotate-3">
            <Mail className="w-8 h-8 text-brand-blue dark:text-brand-cyan" />
          </div>
          <h1 className="text-3xl font-heading font-black text-[#1A237E] dark:text-[#F7F7F7] tracking-tight">
            Verify Email
          </h1>
        </div>

        <div className="bg-white/80 dark:bg-[#111111]/80 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white dark:border-white/5 space-y-8 text-center">
          <div className="space-y-4">
            <p className="text-sm font-bold text-[#1A237E]/60 dark:text-neutral-400 leading-relaxed">
              We have sent you a verification email to <span className="text-brand-blue dark:text-brand-cyan">{user.email}</span>. Please verify it and log in.
            </p>
            
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Note: Please check your <span className="text-brand-blue dark:text-brand-cyan">Spam or Junk</span> folder if you don't see it.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-bold rounded-2xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={isResending || resent}
              className="w-full flex items-center justify-center gap-2 py-4 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-blue/20 dark:shadow-brand-cyan/10 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {resent ? 'Email Sent!' : isResending ? 'Sending...' : (
                <> <Send className="w-4 h-4" /> Resend Email </>
              )}
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white dark:bg-[#1A1A1E] text-neutral-700 dark:text-neutral-200 font-black text-xs uppercase tracking-widest rounded-2xl border border-[#EBEBEB] dark:border-white/10 hover:border-brand-blue/30 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </button>

            <button
              onClick={() => {
                localStorage.setItem('app_bypass_verification', 'true');
                window.location.href = '/';
              }}
              className="w-full pt-4 text-[10px] font-black uppercase tracking-widest text-[#1A237E]/30 dark:text-neutral-600 hover:text-brand-blue dark:hover:text-brand-cyan transition-colors"
            >
              Skip Verification (Testing Only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
