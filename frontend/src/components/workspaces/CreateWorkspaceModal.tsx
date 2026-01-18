/**
 * CreateWorkspaceModal Component
 * Form for creating new workspaces (real database or simulation)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Database, Box } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DbType, CreateWorkspacePayload } from '../../types/workspace';

const realDbSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  db_type: z.nativeEnum(DbType),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  db_name: z.string().min(1, 'Database name is required'),
});

const simulationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  db_type: z.literal(DbType.SIMULATION),
});

type FormData = z.infer<typeof realDbSchema> | z.infer<typeof simulationSchema>;

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWorkspacePayload) => Promise<void>;
}

export function CreateWorkspaceModal({ isOpen, onClose, onSubmit }: CreateWorkspaceModalProps) {
  const [workspaceType, setWorkspaceType] = useState<'real' | 'simulation'>('real');
  const [selectedDbType, setSelectedDbType] = useState<DbType>(DbType.POSTGRES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = workspaceType === 'simulation' ? simulationSchema : realDbSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      db_type: DbType.POSTGRES,
      port: 5432,
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: CreateWorkspacePayload = {
        name: data.name,
        db_type: workspaceType === 'simulation' ? DbType.SIMULATION : selectedDbType,
        ...(workspaceType === 'real' && 'host' in data ? {
          host: data.host,
          port: data.port,
          username: data.username,
          password: data.password,
          db_name: data.db_name,
        } : {}),
      };
      
      await onSubmit(payload);
      reset();
      onClose();
    } catch (error) {
      console.error('Failed to create workspace:', error);
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
          <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            Create New Workspace
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="p-6 border-b border-gray-200 dark:border-border-dark">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setWorkspaceType('real')}
              className={cn(
                'p-4 rounded-xl border-2 transition-all',
                workspaceType === 'real'
                  ? 'border-primary dark:border-primary-dark bg-primary/5 dark:bg-primary-dark/5'
                  : 'border-border-DEFAULT dark:border-border-dark hover:border-primary/50'
              )}
            >
              <Database className={cn(
                'w-8 h-8 mx-auto mb-2',
                workspaceType === 'real'
                  ? 'text-primary dark:text-primary-dark'
                  : 'text-text-muted-DEFAULT dark:text-text-muted-dark'
              )} />
              <div className="text-center">
                <div className="font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                  Connect Database
                </div>
                <div className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                  PostgreSQL or MySQL
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceType('simulation')}
              className={cn(
                'p-4 rounded-xl border-2 transition-all',
                workspaceType === 'simulation'
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-500/5 dark:bg-purple-400/5'
                  : 'border-border-DEFAULT dark:border-border-dark hover:border-purple-500/50'
              )}
            >
              <Box className={cn(
                'w-8 h-8 mx-auto mb-2',
                workspaceType === 'simulation'
                  ? 'text-purple-500 dark:text-purple-400'
                  : 'text-text-muted-DEFAULT dark:text-text-muted-dark'
              )} />
              <div className="text-center">
                <div className="font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                  Create Simulation
                </div>
                <div className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                  Virtual schema only
                </div>
              </div>
            </button>
          </div>
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
                'bg-background-DEFAULT dark:bg-background-dark',
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
          {workspaceType === 'real' && (
            <>
              {/* Database Type */}
              <div>
                <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                  Database Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDbType(DbType.POSTGRES)}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg border transition-all font-medium',
                      selectedDbType === DbType.POSTGRES
                        ? 'border-primary dark:border-primary-dark bg-primary dark:bg-primary-dark text-white'
                        : 'border-border-DEFAULT dark:border-border-dark text-text-main-DEFAULT dark:text-text-main-dark'
                    )}
                  >
                    PostgreSQL
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDbType(DbType.MYSQL)}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg border transition-all font-medium',
                      selectedDbType === DbType.MYSQL
                        ? 'border-primary dark:border-primary-dark bg-primary dark:bg-primary-dark text-white'
                        : 'border-border-DEFAULT dark:border-border-dark text-text-main-DEFAULT dark:text-text-main-dark'
                    )}
                  >
                    MySQL
                  </button>
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
                      'bg-background-DEFAULT dark:bg-background-dark',
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
                      'bg-background-DEFAULT dark:bg-background-dark',
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
                      'bg-background-DEFAULT dark:bg-background-dark',
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
                      'bg-background-DEFAULT dark:bg-background-dark',
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
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  {...register('password' as any)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border',
                    'bg-background-DEFAULT dark:bg-background-dark',
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
                'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark'
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
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
