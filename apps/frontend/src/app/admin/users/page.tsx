'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Search, Loader2, UserPlus, Ban, Edit2, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { toast } from 'react-hot-toast';

export default function UsersManagement() {
    const [users, setUsers] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [page, setPage] = useState(1);

    // Modal States
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    // Add User Form State
    const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user' });
    const [editingUser, setEditingUser] = useState<Record<string, unknown> | null>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getUsers(page, 10, search) as { users: Record<string, unknown>[], total: number };
            setUsers(data.users || []);
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

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await adminService.updateUser(editingUser.id as string, newUser);
                toast.success('User updated successfully');
            } else {
                await adminService.createUser(newUser);
                toast.success('User created successfully');
                setPage(1);
                setSearch('');
                setRoleFilter('all');
            }
            setIsAddUserOpen(false);
            setNewUser({ email: '', password: '', full_name: '', role: 'user' });
            setEditingUser(null);
            fetchUsers();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Action failed');
        }
    };

    const openEditModal = (user: Record<string, unknown>) => {
        setEditingUser(user);
        setNewUser({
            email: user.email as string,
            password: '',
            full_name: user.full_name as string,
            role: user.role as string
        });
        setIsAddUserOpen(true);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setNewUser({ email: '', password: '', full_name: '', role: 'user' });
        setIsAddUserOpen(true);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        try {
            await adminService.deleteUser(userToDelete);
            toast.success('User deleted successfully');
            fetchUsers();
            setIsDeleteOpen(false);
        } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error.message || 'Failed to delete user');
        } finally {
            setUserToDelete(null);
        }
    };

    const filteredUsers = roleFilter === 'all'
        ? users
        : users.filter(u => (u.role as string) === roleFilter);

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">User Management</h2>
                    <p className="text-slate-400 text-sm">Waitlist & Subscriber Administration</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={openAddModal}
                        className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add User
                    </button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex items-center bg-slate-900 border border-slate-800 p-2 rounded-xl">
                    <Search className="w-5 h-5 text-slate-500 ml-2 mr-3" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="bg-transparent border-none text-slate-200 w-full outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-4 py-2.5 outline-none"
                >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-800">
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">User</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Role</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading && users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredUsers.map((user: Record<string, unknown>) => (
                                <tr key={user.id as string} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center">
                                            <div>
                                                <div className="text-sm font-medium text-white">{user.full_name as string || 'Unnamed'}</div>
                                                <div className="text-xs text-slate-500">{user.email as string}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                                            {user.role as string}
                                        </span>
                                    </td>
                                    <td className="p-4 shadow-sm">
                                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center w-fit">
                                            <CheckCircle className="w-3 h-3 mr-1" /> Active
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button onClick={() => openEditModal(user)} className="p-2 hover:bg-slate-800 text-slate-400"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => { setUserToDelete(user.id as string); setIsDeleteOpen(true); }} className="p-2 hover:bg-red-900/20 text-slate-400"><Ban className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title={editingUser ? "Edit User" : "Add User"}>
                <form onSubmit={handleSaveUser} className="space-y-4">
                    <input type="text" placeholder="Full Name" className="w-full bg-slate-950 border border-slate-800 p-2.5 text-white rounded-lg" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                    <input type="email" placeholder="Email" className="w-full bg-slate-950 border border-slate-800 p-2.5 text-white rounded-lg" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} disabled={!!editingUser} />
                    <input type="password" placeholder="Password" className="w-full bg-slate-950 border border-slate-800 p-2.5 text-white rounded-lg" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                    <select className="w-full bg-slate-950 border border-slate-800 p-2.5 text-white rounded-lg" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="w-full bg-primary p-2.5 text-white rounded-lg">{editingUser ? 'Save' : 'Create'}</button>
                </form>
            </Modal>

            <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Delete">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-slate-400 mb-6">Permanently delete this user?</p>
                    <div className="flex gap-4">
                        <button onClick={() => setIsDeleteOpen(false)} className="flex-1 bg-slate-800 p-2.5 rounded-lg text-white">Cancel</button>
                        <button onClick={handleDelete} className="flex-1 bg-red-600 p-2.5 rounded-lg text-white">Delete</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
