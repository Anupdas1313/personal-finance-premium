import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, LogIn, Sparkles, Mail, Lock, UserPlus, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user, signIn, signUp, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    if (!user.emailVerified) {
      return <Navigate to="/verify" replace />;
    }
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        try {
          await signUp(email, password);
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            setError('User already exists. Please sign in');
          } else {
            setError(err.message || 'Failed to create account');
          }
        }
      } else {
        try {
          await signIn(email, password);
        } catch (err: any) {
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            setError('Email or password is incorrect');
          } else {
            setError(err.message || 'Failed to sign in');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Logo Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex w-16 h-16 bg-white dark:bg-[#1A1A1E] rounded-3xl items-center justify-center shadow-2xl border border-brand-blue/5 dark:border-white/5 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Wallet className="w-8 h-8 text-brand-blue dark:text-brand-cyan" />
          </div>
          <h1 className="text-3xl font-heading font-black text-[#1A237E] dark:text-[#F7F7F7] tracking-tight">
            Personal Finance
          </h1>
          <p className="text-sm font-medium text-[#1A237E]/40 dark:text-[#777777] uppercase tracking-[0.2em]">
            Smart Expense Tracking
          </p>
        </div>

        {/* Card Section */}
        <div className="bg-white/80 dark:bg-[#111111]/80 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white dark:border-white/5 space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-heading font-black text-[#1A237E] dark:text-white tracking-tight">
              {isSignUp ? 'Create an account' : 'Welcome back'}
            </h2>
            <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-relaxed">
              {isSignUp ? 'Join us to track your growth' : 'Sign in to access your dashboard'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-brand-blue transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#1A1A1E] border border-[#EBEBEB] dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-brand-blue/20 dark:ring-brand-cyan/20 transition-all text-brand-blue dark:text-white"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-brand-blue transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#1A1A1E] border border-[#EBEBEB] dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-brand-blue/20 dark:ring-brand-cyan/20 transition-all text-brand-blue dark:text-white"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-bold rounded-2xl animate-in shake duration-500">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-4 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-blue/20 dark:shadow-brand-cyan/10 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                <> <UserPlus className="w-4 h-4" /> Sign Up </>
              ) : (
                <> <LogIn className="w-4 h-4" /> Sign In </>
              )}
            </button>
          </form>
          
          <div className="text-center pt-2">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-[10px] font-black uppercase tracking-widest text-brand-blue/60 dark:text-brand-cyan/60 hover:text-brand-blue dark:hover:text-brand-cyan transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest">
            Local First Security • Verified Secure
        </p>
      </div>
    </div>
  );
}
