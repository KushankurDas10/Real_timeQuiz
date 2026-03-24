import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ParticleBackground from '../components/ParticleBackground';

/**
 * Admin Login — email/password authentication via Supabase
 */
export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/admin/dashboard');
      }
      setCheckingSession(false);
    });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) return setError('Enter your email');
    if (!password || password.length < 6) return setError('Password must be at least 6 characters');

    setLoading(true);

    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (result.data?.user?.identities?.length === 0) {
          setError('An account with this email already exists. Try signing in.');
          setLoading(false);
          return;
        }
        // Auto-login after signup
        result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      } else {
        result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      }

      if (result.error) throw result.error;
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg">
        <div className="text-arena-cyan font-display animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <ParticleBackground />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-2">
            <Gamepad2 className="w-9 h-9 text-arena-cyan" />
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white text-glow-cyan">
              GAMEDEV
            </h1>
          </div>
          <h2 className="font-display text-lg font-bold bg-gradient-to-r from-arena-cyan to-arena-magenta bg-clip-text text-transparent">
            ARENA — ADMIN
          </h2>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="glass-card p-6 sm:p-8 animate-slide-up">
          <h3 className="font-display text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-arena-cyan" />
            {isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </h3>

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-arena-bg border-2 border-arena-border rounded-xl pl-10 pr-4 py-3
                           text-white focus:border-arena-cyan focus:outline-none transition-colors
                           placeholder:text-gray-600"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-1 block font-medium">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-arena-bg border-2 border-arena-border rounded-xl pl-10 pr-10 py-3
                           text-white focus:border-arena-cyan focus:outline-none transition-colors
                           placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-arena-red/10 border border-arena-red/30 text-arena-red text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-center disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-sm text-gray-400 hover:text-arena-cyan transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6 font-display tracking-wider">
          POWERED BY GAMEDEV ARENA
        </p>
      </div>
    </div>
  );
}
