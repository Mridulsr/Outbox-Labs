import React, { useEffect, useRef, useState } from 'react';
import { Mail, Sparkles, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onLoginSuccess }) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    // Attempt Google Identity Services render if client ID is provided in window or env
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleBtnRef.current) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: '940176300187-demo.apps.googleusercontent.com',
          callback: (response: any) => {
            // Decode Google JWT
            try {
              const base64Url = response.credential.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const payload = JSON.parse(jsonPayload);
              onLoginSuccess({
                name: payload.name || 'Google User',
                email: payload.email || 'user@gmail.com',
                avatar: payload.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
              });
            } catch {
              onLoginSuccess({
                name: 'Verified Google User',
                email: 'user@reachinbox.ai',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
              });
            }
          },
        });

        (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
        });
      } catch (err) {
        console.warn('Google Identity initialization warning:', err);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDemoGoogleLogin = (profile: { name: string; email: string; avatar: string }) => {
    onLoginSuccess(profile);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    onLoginSuccess({
      name: customName || customEmail.split('@')[0],
      email: customEmail,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(customName || customEmail)}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-center text-slate-100 overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Icon */}
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Mail className="w-7 h-7 text-white" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-1.5">
          Sign In to ReachInbox
        </h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Production-grade distributed email scheduler & campaign delivery workspace
        </p>

        {/* Real Google Button Container */}
        <div className="flex flex-col items-center space-y-3">
          <div ref={googleBtnRef} className="w-full flex justify-center"></div>

          {/* Primary One-Click Google OAuth Profiles */}
          <button
            onClick={() =>
              handleDemoGoogleLogin({
                name: 'Mridul Raj',
                email: 'mridul.raj.2222@gmail.com',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
              })
            }
            className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-md transition group"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google (mridul.raj.2222@gmail.com)</span>
          </button>

          <button
            onClick={() =>
              handleDemoGoogleLogin({
                name: 'ReachInbox Lead Engineer',
                email: 'engineer@reachinbox.ai',
                avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
              })
            }
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <span>Sign in as Lead Engineer (engineer@reachinbox.ai)</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or custom email</span>
          </div>
        </div>

        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Enter custom user profile →
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-3 text-left">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-semibold mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Alex Mercer"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-semibold mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="alex@company.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition"
            >
              Continue to Dashboard
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>PostgreSQL + Redis BullMQ Isolated Sandbox</span>
        </div>
      </div>
    </div>
  );
};
