import { useState, useEffect } from 'react';
import { Search, MoreVertical, Shield, Ban, Trash2, CheckCircle, RefreshCw, AlertCircle, UserCheck, UserX } from 'lucide-react';
import { cn } from '../../lib/utils';
import { adminService, AdminUser } from '../../services/adminService';
import { toast } from 'react-toastify';

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getUsers(search || undefined);
      setUsers(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleToggleActive = async (user: AdminUser) => {
    try {
      setActionLoading(user.id);
      setActiveDropdown(null);
      await adminService.updateUser(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      await fetchUsers(searchQuery);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (user: AdminUser) => {
    try {
      setActionLoading(user.id);
      setActiveDropdown(null);
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      await adminService.updateUser(user.id, { role: newRole });
      toast.success(`User role changed to ${newRole}`);
      await fetchUsers(searchQuery);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to change role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete ${user.email}? This cannot be undone.`)) return;
    try {
      setActionLoading(user.id);
      setActiveDropdown(null);
      await adminService.deleteUser(user.id);
      toast.success('User deleted successfully');
      await fetchUsers(searchQuery);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const totalUsers = users.length;
  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  if (loading && users.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary dark:text-primary-dark animate-spin" />
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchUsers()}
            className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            User Management
          </h1>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
            Manage user accounts and permissions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            {totalUsers}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Total Users</p>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {activeCount}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Active</p>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {adminCount}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Admins</p>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {inactiveCount}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Inactive</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          <input
            type="text"
            placeholder="Search users by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-light dark:bg-background-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-text-main-DEFAULT dark:text-text-main-dark placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border-b border-border-DEFAULT dark:border-border-dark">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Connections
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Queries
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-DEFAULT dark:divide-border-dark">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-text-muted-DEFAULT dark:text-text-muted-dark">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr 
                    key={user.id}
                    className={cn(
                      'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors',
                      actionLoading === user.id && 'opacity-50'
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                          user.role === 'admin' 
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                            : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                        )}>
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                            {user.email.split('@')[0]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          <Shield className="w-3 h-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                          <Ban className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 capitalize">
                        {user.auth_provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                      {user.connections_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                      {user.queries_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                          className="p-1 hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark rounded transition-colors"
                          disabled={actionLoading === user.id}
                        >
                          <MoreVertical className="w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                        </button>
                        
                        {activeDropdown === user.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg shadow-lg z-10">
                            <button
                              onClick={() => handleChangeRole(user)}
                              className="w-full px-4 py-2 text-left text-sm text-text-main-DEFAULT dark:text-text-main-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark flex items-center gap-2 rounded-t-lg"
                            >
                              <Shield className="w-4 h-4" />
                              {user.role === 'admin' ? 'Set as User' : 'Set as Admin'}
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className="w-full px-4 py-2 text-left text-sm text-orange-600 dark:text-orange-400 hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark flex items-center gap-2"
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="w-4 h-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4" />
                                  Activate
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark flex items-center gap-2 rounded-b-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
