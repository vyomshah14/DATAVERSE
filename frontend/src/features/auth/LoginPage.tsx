import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import {
  Server,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Loader2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    signUp,
    isAuthenticated,
    isInitializing,
    isLoading,
    error,
    successMessage,
    clearError,
    clearSuccessMessage,
  } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Preserve intended destination route
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated && !isInitializing) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    clearError();
    clearSuccessMessage();

    // Client-side validation
    if (!email || !email.includes('@')) {
      setClientError('Please provide a valid operator email address.');
      return;
    }

    if (password.length < 6) {
      setClientError('Password must be at least 6 characters in length.');
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        setClientError('Passwords do not match. Please verify and re-enter.');
        return;
      }

      const success = await signUp(email, password);
      if (success) {
        // If sign-up succeeded without requiring email confirmation, navigate
        // If email confirmation is required, successMessage will be displayed
        if (useAuthStore.getState().isAuthenticated) {
          navigate(from, { replace: true });
        }
      }
    } else {
      const success = await login(email, password);
      if (success) {
        navigate(from, { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Ambience & Lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_25px_-4px_rgba(6,182,212,0.4)] mb-3">
            <Server className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-wider text-white">DATAVERSE</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
              v0.1
            </span>
          </div>
          <p className="text-xs font-mono tracking-tight text-slate-400 mt-1 uppercase">
            3D Living Data Center Simulator
          </p>
        </div>

        {/* Console Authentication Card */}
        <div className="rounded-2xl bg-[#080d1a]/95 border border-slate-800 shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden">
          {/* Tab Selection */}
          <div className="flex border-b border-slate-800/80 bg-slate-950/60 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setClientError(null);
                clearError();
                clearSuccessMessage();
              }}
              className={`flex-1 py-3 text-center transition-all border-b-2 font-medium ${
                !isSignUp
                  ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Operator Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setClientError(null);
                clearError();
                clearSuccessMessage();
              }}
              className={`flex-1 py-3 text-center transition-all border-b-2 font-medium ${
                isSignUp
                  ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="p-6">
            {/* Success Message Banner */}
            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-start gap-3 text-xs text-emerald-300 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div className="leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* Error Message Banner */}
            {(error || clientError) && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-start gap-3 text-xs text-rose-300 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="leading-relaxed">{clientError || error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-[11px] font-mono text-slate-300 uppercase mb-1.5">
                  Operator Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@codeversetech.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-colors"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[11px] font-mono text-slate-300 uppercase mb-1.5">
                  Security Passkey
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (only on Sign Up) */}
              {isSignUp && (
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 uppercase mb-1.5">
                    Confirm Security Passkey
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Submit Action */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <span>{isSignUp ? 'Provision Operator Account' : 'Authenticate Console'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security Banner Footer */}
          <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Supabase Managed Session</span>
            </span>
            <span className="text-slate-400">JWT Token</span>
          </div>
        </div>

        {/* Secondary Back Navigation / Prompt */}
        <div className="text-center mt-4">
          <p className="text-[11px] font-mono text-slate-400">
            Authorized Personnel Only • CodeVerse Tech Enterprise Cloud
          </p>
        </div>
      </div>
    </div>
  );
};
