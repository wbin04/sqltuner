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

          {/* Sign Up Link */}
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
