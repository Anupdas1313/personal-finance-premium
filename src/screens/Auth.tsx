import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Wallet, AlertCircle } from 'lucide-react';

export default function Auth() {
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Email or password is incorrect');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('User already exists. Please sign in');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex flex-col justify-center px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-blue rounded-[20px] shadow-lg shadow-brand-blue/20 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-black text-brand-blue dark:text-white tracking-tight">Expensify</h1>
          <p className="text-sm font-bold text-neutral-500 mt-1 uppercase tracking-widest">Master your money</p>
        </div>

        <div className="bg-white dark:bg-[#121216] rounded-[32px] p-6 sm:p-8 shadow-sm border border-neutral-100 dark:border-white/5">
          <h2 className="text-xl font-heading font-black text-neutral-800 dark:text-white mb-6">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-white/10 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-white/10 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-brand-blue/20 disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 border-t border-neutral-200 dark:border-white/5 w-full"></div>
            <span className="relative bg-white dark:bg-[#121216] px-4 text-xs font-black text-neutral-400 uppercase tracking-widest">or</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/[0.02] text-neutral-800 dark:text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.568 0-6.477-2.909-6.477-6.477s2.909-6.477 6.477-6.477c1.78 0 3.398.72 4.584 1.89l3.136-3.136C19.78 1.945 16.224 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.76 0 12.24-5.48 12.24-12.24 0-.84-.085-1.654-.24-2.435H12.24Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm font-bold text-neutral-500 hover:text-brand-blue dark:hover:text-white transition-colors cursor-pointer"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
