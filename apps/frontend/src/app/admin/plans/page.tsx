'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Loader2, Plus, Edit2, Trash2, Check, X, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Plan {
    id: string;
    name: string;
    price: number;
    duration_days: number;
    is_active: boolean;
}

export default function PlansManagement() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newPlan, setNewPlan] = useState<Partial<Plan> | null>(null);

    // Form states for editing
    const [formData, setFormData] = useState<Partial<Plan>>({});

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getPlans();
            setPlans(data);
        } catch (error) {
            toast.error('Failed to load plans');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, []);

    const handleEdit = (plan: Plan) => {
        setEditingId(plan.id);
        setFormData(plan);
        setNewPlan(null); // Cancel new mode if editing
    };

    const handleAddNew = () => {
        setNewPlan({ name: '', price: 0, duration_days: 30, is_active: true });
        setEditingId(null);
        setFormData({});
    };

    const handleSave = async (isNew: boolean) => {
        try {
            if (isNew && newPlan) {
                await adminService.createPlan(newPlan);
                toast.success('Plan created');
                setNewPlan(null);
            } else if (editingId && formData) {
                await adminService.updatePlan(editingId, formData);
                toast.success('Plan updated');
                setEditingId(null);
            }
            fetchPlans();
        } catch (error) {
            toast.error('Failed to save plan');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deactivate this plan? Users will no longer be able to purchase it.')) return;
        try {
            await adminService.deletePlan(id);
            toast.success('Plan deactivated');
            fetchPlans();
        } catch (error) {
            toast.error('Failed to deactivate plan');
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setNewPlan(null);
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Subscription Plans</h2>
                    <p className="text-slate-400 text-sm">Manage pricing tiers and offerings</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Plan
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* New Plan Card */}
                {newPlan && (
                    <div className="bg-slate-900 border-2 border-primary/50 border-dashed rounded-xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-primary">New Plan</h3>
                            <input
                                className="w-full bg-slate-800 border-none rounded p-2 text-white placeholder:text-slate-500"
                                placeholder="Plan Name (e.g. VIP)"
                                value={newPlan.name || ''}
                                onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border-none rounded p-2 text-white"
                                    placeholder="Price (INR)"
                                    value={newPlan.price || ''}
                                    onChange={e => setNewPlan({ ...newPlan, price: Number(e.target.value) })}
                                />
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border-none rounded p-2 text-white"
                                    placeholder="Days"
                                    value={newPlan.duration_days || ''}
                                    onChange={e => setNewPlan({ ...newPlan, duration_days: Number(e.target.value) })}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => handleSave(true)} className="flex-1 bg-primary text-white py-2 rounded hover:bg-primary/90">Create</button>
                                <button onClick={handleCancel} className="flex-1 bg-slate-800 text-white py-2 rounded hover:bg-slate-700">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Existing Plans */}
                {isLoading ? (
                    <p className="text-slate-500">Loading plans...</p>
                ) : plans.map((plan) => (
                    <div key={plan.id} className={`bg-slate-900 border ${!plan.is_active ? 'border-red-900/50 opacity-75' : 'border-slate-800'} rounded-xl p-6 transition-all hover:border-slate-700`}>
                        {editingId === plan.id ? (
                            <div className="space-y-4">
                                <input
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-500">₹</span>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 pl-6 text-white"
                                            value={formData.price || ''}
                                            onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                                        value={formData.duration_days || ''}
                                        onChange={e => setFormData({ ...formData, duration_days: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleSave(false)} className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleCancel} className="p-2 bg-slate-800 text-slate-400 rounded hover:bg-slate-700">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                                        {!plan.is_active && <span className="text-xs text-red-500 font-medium bg-red-500/10 px-2 py-0.5 rounded">Inactive</span>}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-primary">₹{plan.price}</div>
                                        <div className="text-xs text-slate-500">{plan.duration_days} Days</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t border-slate-800/50">
                                    <button onClick={() => handleEdit(plan)} className="flex-1 flex items-center justify-center py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 transition-colors">
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Edit
                                    </button>
                                    {plan.is_active && (
                                        <button onClick={() => handleDelete(plan.id)} className="p-2 hover:bg-red-900/20 text-slate-500 hover:text-red-400 rounded transition-colors" title="Deactivate">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
