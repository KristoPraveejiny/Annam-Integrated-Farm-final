import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { CheckCircle2, XCircle, RefreshCcw, AlertTriangle, FileImage } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';

export default function ManagerReviewPanel({ task, onReviewComplete }: { task: any, onReviewComplete: () => void }) {
    const [evidence, setEvidence] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (task) {
            fetchEvidence();
        }
    }, [task]);

    const fetchEvidence = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/tasks/${task.id}/evidence`);
            if (res.ok) {
                const data = await res.json();
                setEvidence(data);
            }
        } catch (err) {
            console.error('Error fetching evidence:', err);
            notifyError('Failed to load task evidence.');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: string) => {
        if (['Reject', 'Request Rework'].includes(action) && !reason.trim()) {
            notifyError('Reason is required for rejecting or requesting rework.');
            return;
        }

        try {
            setActionLoading(true);
            const res = await apiFetch(`/api/tasks/${task.id}/review`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason })
            });

            if (res.ok) {
                notifySuccess(`Task successfully ${action.toLowerCase()}ed.`);
                onReviewComplete();
            } else {
                const errData = await res.json();
                notifyError(errData.error || `Failed to ${action} task.`);
            }
        } catch (err) {
            console.error(err);
            notifyError(`Error performing action: ${action}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-slate-300">Loading evidence...</div>;
    }

    if (!evidence) {
        return (
            <Card title="Task Review">
                <div className="p-4 text-center text-slate-400">
                    <AlertTriangle className="mx-auto mb-2 opacity-50" size={32} />
                    <p>No evidence submitted for this task yet.</p>
                </div>
            </Card>
        );
    }

    const images = evidence.images || [];

    return (
        <Card title="Review Task Submission">
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Start Time</p>
                        <p className="text-sm text-slate-200 font-medium">
                            {task.actual_start_time ? new Date(task.actual_start_time).toLocaleString() : 'N/A'}
                        </p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Submission Time</p>
                        <p className="text-sm text-slate-200 font-medium">
                            {task.submission_time ? new Date(task.submission_time).toLocaleString() : 'N/A'}
                        </p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Working Hours</p>
                        <p className="text-sm text-slate-200 font-medium">{task.working_hours || 0} hrs</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Status</p>
                        <p className={`text-sm font-medium ${task.status === 'late_submission' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {task.status.replace(/_/g, ' ').toUpperCase()}
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Worker Notes</h3>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-slate-300">
                        {evidence.notes || 'No notes provided.'}
                    </div>
                </div>

                {images.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-2">Evidence Images</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {images.map((img: any, idx: number) => (
                                <a key={idx} href={img.url} target="_blank" rel="noreferrer" className="block relative aspect-square rounded-xl overflow-hidden group border border-white/10">
                                    <img src={img.url} alt={`Evidence ${idx + 1}`} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                        <FileImage className="text-white" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t border-white/10 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Review Comments (Required for Reject/Rework)</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[100px]"
                            placeholder="Add your comments here..."
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="primary"
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => handleAction('Approve')}
                            disabled={actionLoading}
                        >
                            <CheckCircle2 size={18} className="mr-2" /> Approve Task
                        </Button>
                        <Button
                            variant="ghost"
                            className="flex-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                            onClick={() => handleAction('Request Rework')}
                            disabled={actionLoading}
                        >
                            <RefreshCcw size={18} className="mr-2" /> Request Rework
                        </Button>
                        <Button
                            variant="ghost"
                            className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => handleAction('Reject')}
                            disabled={actionLoading}
                        >
                            <XCircle size={18} className="mr-2" /> Reject
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
