'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Loader2, AlertCircle, Search, UserPlus, MoreVertical, Edit2, Ban, CheckCircle } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { toast } from 'react-hot-toast';

export default function UsersManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [stats, setStats] = useState({ total: 0, page: 1, totalPages: 1 });
    const [isLoading, setIsLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [page, setPage] = useState(1);

    // Modal States
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [deleteInput, setDeleteInput] = useState(''); // For extra safety confirming deletion if needed? nah simple confirm is generic enough

    // Add User Form State
    const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user' });

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            // Note: Update backend to support role filter if needed, or filter client side for now if small dataset
            // Assuming API handles search perfectly
            const data = await adminService.getUsers(page, 10, search);
            setUsers(data.users);
            setStats({ total: data.total, page: data.page, totalPages: data.totalPages });
        } catch (error) {
            console.error(error);
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(fetchUsers, 300);
        return () => clearTimeout(timeout);
    }, [page, search]);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingAction('add');
        try {
            await adminService.createUser(newUser);
            toast.success('User created successfully');
            setIsAddUserOpen(false);
            setNewUser({ email: '', password: '', full_name: '', role: 'user' });
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create user');
        } finally {
            setLoadingAction(null);
        }
    };

    const confirmDelete = (userId: string) => {
        setUserToDelete(userId);
        setIsDeleteOpen(true);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        setLoadingAction(userToDelete);
        try {
            await adminService.deleteUser(userToDelete);
            toast.success('User deleted successfully');
            fetchUsers();
            setIsDeleteOpen(false);
        } catch (error) {
            toast.error('Failed to delete user');
        } finally {
            setLoadingAction(null);
            setUserToDelete(null);
        }
    };

    // Filter logic (Client side for now as API support might be limited)
    const filteredUsers = roleFilter === 'all'
        ? users
        : users.filter(u => u.role === roleFilter);

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">User Management</h2>
                    <p className="text-slate-400 text-sm">Waitlist & Subscriber Administration</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAddUserOpen(true)}
                        className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-primary/20"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add User
                    </button>
                </div>
            </header>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex items-center bg-slate-900 border border-slate-800 p-2 rounded-xl focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                    <Search className="w-5 h-5 text-slate-500 ml-2 mr-3" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        className="bg-transparent border-none focus:ring-0 text-slate-200 w-full placeholder:text-slate-600 outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    >
                        <option value="all">All Roles</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm">
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-600" />
                                        <p>Loading users database...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Search className="w-8 h-8 mb-3 opacity-20" />
                                            <p>No users found matching query.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center">
                                                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400 mr-3 border border-slate-700">
                                                    {(user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{user.full_name || 'N/A'}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center w-fit font-medium">
                                                <CheckCircle className="w-3 h-3 mr-1.5" />
                                                Active
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500">
                                            {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Edit details">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(user.id)}
                                                    className="p-2 hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                    title="Ban User"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add User Modal */}
            <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="Add User to Database">
                <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Full Name</label>
                        <input
                            type="text"
                            required
                            placeholder="John Doe"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                            value={newUser.full_name}
                            onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="john@example.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                            value={newUser.email}
                            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Role</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsAddUserOpen(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loadingAction === 'add'}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
                        >
                            {loadingAction === 'add' && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Create User
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Deletion">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Are you sure?</h3>
                    <p className="text-slate-400 text-sm mb-6">
                        This action cannot be undone. This will permanently delete the user account and user data from our servers.
                    </p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => setIsDeleteOpen(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={loadingAction === userToDelete}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
                        >
                            {loadingAction === userToDelete && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Delete User
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
