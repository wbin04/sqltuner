import { useState } from 'react';
import { Search, MoreVertical, UserPlus, Shield, Ban, Trash2, Key } from 'lucide-react';
import { cn } from '../../lib/utils';

// Mock User Data
const usersData = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    lastActive: '2026-01-17 10:23',
    queriesCount: 234,
  },
  {
    id: 2,
    name: 'Sarah Smith',
    email: 'sarah@example.com',
    role: 'user',
    status: 'active',
    lastActive: '2026-01-17 09:15',
    queriesCount: 156,
  },
  {
    id: 3,
    name: 'Admin User',
    email: 'admin@gmail.com',
    role: 'admin',
    status: 'active',
    lastActive: '2026-01-17 11:42',
    queriesCount: 89,
  },
  {
    id: 4,
    name: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'user',
    status: 'banned',
    lastActive: '2026-01-15 14:20',
    queriesCount: 45,
  },
  {
    id: 5,
    name: 'Emma Wilson',
    email: 'emma@example.com',
    role: 'user',
    status: 'active',
    lastActive: '2026-01-17 08:42',
    queriesCount: 312,
  },
];

export function UserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  const filteredUsers = usersData.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = (action: string, userId: number) => {
    console.log(`${action} user ${userId}`);
    setActiveDropdown(null);
  };

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
        <button className="px-4 py-2 bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white rounded-lg flex items-center gap-2 transition-colors">
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            {usersData.length}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Total Users</p>
        </div>
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {usersData.filter(u => u.status === 'active').length}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Active</p>
        </div>
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {usersData.filter(u => u.role === 'admin').length}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Admins</p>
        </div>
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {usersData.filter(u => u.status === 'banned').length}
          </p>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Banned</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-DEFAULT dark:bg-background-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-text-main-DEFAULT dark:text-text-main-dark placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
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
                  Queries
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-DEFAULT dark:divide-border-dark">
              {filteredUsers.map((user) => (
                <tr 
                  key={user.id}
                  className="hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                        user.role === 'admin' 
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                          : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                      )}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                          {user.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.status === 'active' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        <Ban className="w-3 h-3" />
                        Banned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                    {user.queriesCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark whitespace-nowrap">
                    {user.lastActive}
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                        className="p-1 hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark rounded transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                      </button>
                      
                      {activeDropdown === user.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-surface-DEFAULT dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => handleAction('edit-role', user.id)}
                            className="w-full px-4 py-2 text-left text-sm text-text-main-DEFAULT dark:text-text-main-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark flex items-center gap-2"
                          >
                            <Shield className="w-4 h-4" />
                            Change Role
                          </button>
                          <button
                            onClick={() => handleAction('reset-password', user.id)}
                            className="w-full px-4 py-2 text-left text-sm text-text-main-DEFAULT dark:text-text-main-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark flex items-center gap-2"
                          >
                            <Key className="w-4 h-4" />
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleAction('ban', user.id)}
                            className="w-full px-4 py-2 text-left text-sm text-orange-600 dark:text-orange-400 hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark flex items-center gap-2"
                          >
                            <Ban className="w-4 h-4" />
                            {user.status === 'active' ? 'Ban User' : 'Unban User'}
                          </button>
                          <button
                            onClick={() => handleAction('delete', user.id)}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
