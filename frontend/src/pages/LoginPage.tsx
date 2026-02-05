import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// Validation Schema
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(5, 'Password must be at least 5 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await login(data.email, data.password);
      // Navigation is handled in AuthContext based on role
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 dark:from-primary-dark/5 dark:to-secondary-dark/5" />
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.1) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className={cn(
          'rounded-2xl shadow-2xl p-8',
          'bg-surface-light dark:bg-slate-900',
          'border border-border-DEFAULT dark:border-slate-800'
        )}>
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Zap className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark bg-clip-text text-transparent">
              SQLTuner
            </h1>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-2">
              AI-Powered SQL Optimization
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  defaultValue="quochuy@gmail.com"
                  className={cn(
                    'w-full rounded-lg border pl-10 pr-4 py-3 text-sm transition-all',
                    'bg-background-light dark:bg-background-dark',
                    'border-border-DEFAULT dark:border-border-dark',
                    'text-text-main-DEFAULT dark:text-text-main-dark',
                    'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50 focus:border-primary dark:focus:border-primary-dark',
                    errors.email && 'border-red-500 focus:ring-red-500/50'
                  )}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  defaultValue="quochuy123"
                  className={cn(
                    'w-full rounded-lg border pl-10 pr-12 py-3 text-sm transition-all',
                    'bg-background-light dark:bg-background-dark',
                    'border-border-DEFAULT dark:border-border-dark',
                    'text-text-main-DEFAULT dark:text-text-main-dark',
                    'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50 focus:border-primary dark:focus:border-primary-dark',
                    errors.password && 'border-red-500 focus:ring-red-500/50'
                  )}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border-DEFAULT dark:border-border-dark text-primary dark:text-primary-dark focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50"
                  {...register('rememberMe')}
                />
                <span className="text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                  Remember me for 30 days
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary dark:text-primary-dark hover:text-primary-hover dark:hover:text-primary-dark-hover transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'w-full rounded-lg py-3 px-4 font-medium text-white transition-all',
                'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'shadow-lg shadow-primary/20 dark:shadow-primary-dark/20',
                'hover:shadow-xl hover:shadow-primary/30 dark:hover:shadow-primary-dark/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-DEFAULT dark:border-border-dark"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface-light dark:bg-slate-900 text-text-muted-DEFAULT dark:text-text-muted-dark">
                  Or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                window.location.href = `${apiUrl}/auth/login/google`;
              }}
              className={cn(
                'w-full mt-4 rounded-lg py-3 px-4 font-medium transition-all',
                'bg-white dark:bg-slate-800 text-gray-900 dark:text-white',
                'border border-border-DEFAULT dark:border-border-dark',
                'hover:bg-gray-50 dark:hover:bg-slate-700',
                'shadow-sm hover:shadow-md',
                'flex items-center justify-center gap-3'
              )}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-primary dark:text-primary-dark hover:text-primary-hover dark:hover:text-primary-dark-hover transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
          © 2026 SQLTuner. All rights reserved.
        </div>
      </div>
    </div>
  );
}
