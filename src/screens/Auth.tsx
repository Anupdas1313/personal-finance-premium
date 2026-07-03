import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Wallet, AlertCircle, Mail } from 'lucide-react';

export default function Auth() {
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);

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
        setIsVerificationSent(true);
      }
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Email or password is incorrect');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('User already exists. Please sign in');
      } else if (err.code === 'auth/email-not-verified') {
        setIsVerificationSent(true);
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
    <div className="min-h-screen bg-neutral-50 dark:bg-[#060608] flex flex-col justify-center px-4 py-6 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-blue/20 dark:bg-brand-cyan/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full mx-auto relative z-10">
        <div className="flex flex-col items-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-blue to-brand-blue/80 dark:from-brand-cyan dark:to-brand-blue rounded-2xl shadow-xl shadow-brand-blue/20 flex items-center justify-center mb-2 rotate-3 hover:rotate-0 transition-transform">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-black text-neutral-900 dark:text-white tracking-tight">Expensify</h1>
          <p className="text-[10px] font-bold text-neutral-500 mt-1 uppercase tracking-[0.2em]">Master your money</p>
        </div>

        <div className="bg-white/80 dark:bg-[#111114]/80 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white dark:border-white/5 relative overflow-hidden">
          
          {isVerificationSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-brand-blue/10 dark:bg-brand-cyan/10 rounded-2xl mx-auto flex items-center justify-center mb-6">
                <Mail className="w-8 h-8 text-brand-blue dark:text-brand-cyan" />
              </div>
              <h2 className="text-xl font-heading font-black text-neutral-900 dark:text-white mb-3">
                Check your email
              </h2>
              <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8">
                We have sent you a verification email to <span className="text-neutral-900 dark:text-white font-bold">{email}</span>. Please verify it and log in.
              </p>
              <button
                onClick={() => {
                  setIsVerificationSent(false);
                  setIsLogin(true);
                }}
                className="w-full bg-brand-blue dark:bg-brand-cyan hover:brightness-110 text-white dark:text-brand-blue font-bold py-3 rounded-2xl transition-all shadow-lg shadow-brand-blue/20 dark:shadow-brand-cyan/10 text-sm uppercase tracking-wider"
              >
                Log In
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-heading font-black text-neutral-900 dark:text-white mb-6">
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h2>

              {error && (
                <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-start gap-3 border border-rose-100 dark:border-rose-500/20">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-100/50 dark:bg-black/20 border border-neutral-200/60 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 dark:focus:ring-brand-cyan/30 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="block text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Password</label>
                    {isLogin && (
                      <button 
                        type="button" 
                        onClick={async () => {
                          if (!email) {
                            setError('Please enter your email to reset password');
                            return;
                          }
                          try {
                            setLoading(true);
                            await resetPassword(email);
                            setError('');
                            alert('Password reset link sent to your email.');
                          } catch (err: any) {
                            setError(err.message || 'Failed to send reset link');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="text-[10px] font-black text-brand-blue dark:text-brand-cyan uppercase tracking-widest hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-100/50 dark:bg-black/20 border border-neutral-200/60 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 dark:focus:ring-brand-cyan/30 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    placeholder="••••••••"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-blue dark:bg-brand-cyan hover:brightness-110 text-white dark:text-brand-blue font-bold py-3 rounded-2xl transition-all shadow-lg shadow-brand-blue/20 dark:shadow-brand-cyan/10 disabled:opacity-50 mt-2 text-sm uppercase tracking-wider"
                >
                  {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-white/10"></div>
                </div>
                <span className="relative bg-white dark:bg-[#111114] px-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Or Continue With</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white dark:bg-white/5 hover:bg-neutral-50 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-brand-blue dark:hover:text-white transition-colors"
                >
                  {isLogin ? (
                    <>Don't have an account? <span className="text-brand-blue dark:text-brand-cyan font-bold">Sign up</span></>
                  ) : (
                    <>Already have an account? <span className="text-brand-blue dark:text-brand-cyan font-bold">Sign in</span></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
