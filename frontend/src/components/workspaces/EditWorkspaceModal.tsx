/**
 * EditWorkspaceModal Component
 * Form for editing existing workspace connection details
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Database, Box } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DbType, Workspace } from '../../types/workspace';

const realDbSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
  db_name: z.string().min(1, 'Database name is required'),
});

const simulationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

type FormData = z.infer<typeof realDbSchema> | z.infer<typeof simulationSchema>;

interface EditWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Workspace>) => Promise<void>;
  workspace: Workspace;
}

export function EditWorkspaceModal({ isOpen, onClose, onSubmit, workspace }: EditWorkspaceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSimulation = workspace.db_type === DbType.SIMULATION;

  const schema = isSimulation ? simulationSchema : realDbSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: workspace.name,
      ...(isSimulation ? {} : {
        host: workspace.host || '',
        port: workspace.port || 5432,
        username: workspace.username || '',
        db_name: workspace.db_name || '',
        password: '',
      }),
    },
  });

  // Reset form when workspace changes
  useEffect(() => {
    reset({
      name: workspace.name,
      ...(isSimulation ? {} : {
        host: workspace.host || '',
        port: workspace.port || 5432,
        username: workspace.username || '',
        db_name: workspace.db_name || '',
        password: '',
      }),
    });
  }, [workspace, isSimulation, reset]);

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: Partial<Workspace> = {
        name: data.name,
        ...(isSimulation ? {} : 'host' in data ? {
          host: data.host,
          port: data.port,
          username: data.username,
          db_name: data.db_name,
          ...(data.password ? { password: data.password } : {}),
        } : {}),
      };
      
      await onSubmit(payload);
      onClose();
    } catch (error) {
      console.error('Failed to update workspace:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/50 backdrop-blur-sm">
      <div className={cn(
        'relative w-full max-w-2xl rounded-2xl shadow-2xl',
        'bg-white dark:bg-surface-dark',
        'border border-gray-200 dark:border-border-dark'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
          <div className="flex items-center gap-3">
            {isSimulation ? (
              <Box className="w-6 h-6 text-purple-500 dark:text-purple-400" />
            ) : (
              <Database className="w-6 h-6 text-primary dark:text-primary-dark" />
            )}
            <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              Edit Workspace
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              Workspace Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="My Production DB"
              className={cn(
                'w-full px-4 py-2 rounded-lg border transition-all',
                'bg-background-light dark:bg-background-dark',
                'border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50',
                errors.name && 'border-red-500'
              )}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Real Database Fields */}
          {!isSimulation && (
            <>
              {/* Database Type (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                  Database Type
                </label>
                <div className={cn(
                  'px-4 py-2 rounded-lg border',
                  'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark',
                  'border-border-DEFAULT dark:border-border-dark',
                  'text-text-muted-DEFAULT dark:text-text-muted-dark'
                )}>
                  {workspace.db_type === DbType.POSTGRES ? 'PostgreSQL' : 'MySQL'} (cannot be changed)
                </div>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                    Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('host' as any)}
                    placeholder="localhost"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg border',
                      'bg-background-light dark:bg-background-dark',
                      'border-border-DEFAULT dark:border-border-dark',
                      'text-text-main-DEFAULT dark:text-text-main-dark',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50',
                      'host' in errors && errors.host && 'border-red-500'
                    )}
                  />
                  {'host' in errors && errors.host && (
                    <p className="mt-1 text-sm text-red-500">{errors.host.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    {...register('port' as any, { valueAsNumber: true })}
                    placeholder="5432"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg border',
                      'bg-background-light dark:bg-background-dark',
                      'border-border-DEFAULT dark:border-border-dark',
                      'text-text-main-DEFAULT dark:text-text-main-dark',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                  />
                </div>
              </div>

              {/* Username & Database */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('username' as any)}
                    placeholder="postgres"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg border',
                      'bg-background-light dark:bg-background-dark',
                      'border-border-DEFAULT dark:border-border-dark',
                      'text-text-main-DEFAULT dark:text-text-main-dark',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50',
                      'username' in errors && errors.username && 'border-red-500'
                    )}
                  />
                  {'username' in errors && errors.username && (
                    <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                    Database Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('db_name' as any)}
                    placeholder="mydb"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg border',
                      'bg-background-light dark:bg-background-dark',
                      'border-border-DEFAULT dark:border-border-dark',
                      'text-text-main-DEFAULT dark:text-text-main-dark',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50',
                      'db_name' in errors && errors.db_name && 'border-red-500'
                    )}
                  />
                  {'db_name' in errors && errors.db_name && (
                    <p className="mt-1 text-sm text-red-500">{errors.db_name.message}</p>
                  )}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                  Password <span className="text-text-muted-DEFAULT dark:text-text-muted-dark text-xs">(leave empty to keep current)</span>
                </label>
                <input
                  type="password"
                  {...register('password' as any)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border',
                    'bg-background-light dark:bg-background-dark',
                    'border-border-DEFAULT dark:border-border-dark',
                    'text-text-main-DEFAULT dark:text-text-main-dark',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'password' in errors && errors.password && 'border-red-500'
                  )}
                />
                {'password' in errors && errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
                'border border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors',
                'bg-primary dark:bg-primary-dark',
                'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
