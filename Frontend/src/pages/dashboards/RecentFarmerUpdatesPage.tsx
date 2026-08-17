import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

type TaskUpdate = {
  id: string;
  task_id: string;
  task_title: string;
  task_description?: string | null;
  task_status?: string | null;
  status?: string | null; // Added to reflect possible backend field
  ai_explanation?: string | null; // Added for duplicate detection logic
  farmer_id?: string | null;
  farmer_name?: string | null;
  farmer_phone?: string | null;
  notes?: string | null;
  image_url?: string | null;
  crop_name?: string | null;
  livestock_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  working_hours?: string | number | null;
  created_at: string;
  progress_percentage?: number | null;
  session?: string | null;
  images?: any[] | string | null;
};

function normalizeStatus(status: string | undefined | null) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function getStoredUserRole() {
  const stored = localStorage.getItem('user');
  if (!stored) return '';
  try {
    const parsed = JSON.parse(stored);
    return String(parsed?.role || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export default function RecentFarmerUpdatesPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [recentUpdates, setRecentUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState<TaskUpdate | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [userRole, setUserRole] = useState('');

  const isManager = useMemo(
    () => ['farm_manager', 'super_admin'].includes(userRole),
    [userRole],
  );

  useEffect(() => {
    setUserRole(getStoredUserRole());
  }, []);

  const fetchData = async () => {
    try {
      const updatesRes = await apiFetch('/api/tasks/updates/recent');
      if (updatesRes.ok) {
        const updatesData = await updatesRes.json();
        setRecentUpdates(updatesData);
      } else {
        const errorData = await updatesRes.json().catch(() => ({}));
        notifyError(errorData.error || 'Failed to load farmer updates');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      notifyError('Failed to load farmer updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const stateTaskId = (location.state as { taskId?: string } | null)?.taskId;
    if (!stateTaskId || recentUpdates.length === 0 || selectedUpdate) return;
    const matched = recentUpdates.find((update) => String(update.task_id) === String(stateTaskId));
    if (matched) {
      setSelectedUpdate(matched);
    }
  }, [location.state, recentUpdates, selectedUpdate]);

  const pendingApprovals = recentUpdates.filter((update) => {
    const status = normalizeStatus(update.task_status);
    return status === 'waiting_manager_approval' || status === 'waiting_for_manager_approval';
  });

  const closeSelectedUpdate = () => {
    setSelectedUpdate(null);
    setReviewReason('');
    navigate('/dashboard/farm-manager/recent-updates', { replace: true });
  };

  const groupedUpdates = useMemo(() => {
    const map = new Map<string, TaskUpdate & { total_updates_in_group: number }>();
    recentUpdates.forEach((update) => {
      const dateKey = new Date(update.created_at).toLocaleDateString();
      const key = `${update.task_id}-${dateKey}`;
      if (!map.has(key)) {
        map.set(key, { ...update, total_updates_in_group: 1 });
      } else {
        const existing = map.get(key)!;
        existing.total_updates_in_group += 1;
      }
    });
    return Array.from(map.values());
  }, [recentUpdates]);

  const updatesForSelectedTask = useMemo(() => {
    if (!selectedUpdate) return [];
    return recentUpdates.filter(
      (u) => 
        u.task_id === selectedUpdate.task_id && 
        new Date(u.created_at).toLocaleDateString() === new Date(selectedUpdate.created_at).toLocaleDateString()
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedUpdate, recentUpdates]);

  const reviewTask = async (action: 'Approve' | 'Reject' | 'Request Rework') => {
    if (!selectedUpdate) return;
    if ((action === 'Reject' || action === 'Request Rework') && !reviewReason.trim()) {
      notifyWarning('Please enter a reason before sending the task back.');
      return;
    }

    try {
      setReviewLoading(true);
      const res = await apiFetch(`/api/tasks/${selectedUpdate.task_id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reviewReason.trim() })
      });

      if (res.ok) {
        notifySuccess(
          action === 'Approve'
            ? 'Task approved successfully.'
            : action === 'Reject'
              ? 'Task rejected.'
              : 'Rework requested.'
        );
        closeSelectedUpdate();
        fetchData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        notifyError(errorData.error || 'Failed to review task');
      }
    } catch (err) {
      console.error('Review error:', err);
      notifyError('Failed to review task');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={t('Farm Monitoring')}
        title={t('Farmer Updates')}
        description={t('Review completed work, inspect evidence, and approve or send tasks back for rework.')}
        tone="light"
      />

      {isManager && (
        <Card title={t('Pending Approvals')} subtitle={t('Tasks waiting for manager review')}>
          {loading ? (
            <div className="py-8 text-center text-slate-500">{t('Loading updates...')}</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="py-8 text-center text-slate-500">{t('No pending approvals.')}</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {pendingApprovals.map((update) => (
                <div key={update.id} className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-white">{update.task_title}</h4>
                      <p className="mt-1 text-sm text-slate-300">{update.farmer_name}</p>
                    </div>
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-200">
                      {t('Waiting Manager Approval')}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-300">{update.notes || t('No notes provided.')}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">{new Date(update.created_at).toLocaleDateString()}</span>
                    <Button type="button" onClick={() => setSelectedUpdate(update)} className="whitespace-nowrap">
                      {t('View Details')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title={t('Recent Farmer Updates')} subtitle={t('Latest completed task notes and images from the field')}>
        {loading ? (
          <div className="py-8 text-center text-slate-500">{t('Loading updates...')}</div>
        ) : groupedUpdates.length === 0 ? (
          <div className="py-8 text-center text-slate-500">{t('No recent updates.')}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groupedUpdates.map((update) => (
              <div key={update.id} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/40 p-5 shadow-lg relative overflow-hidden">
                {update.total_updates_in_group > 1 && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-md z-10">
                    {update.total_updates_in_group} Updates Today
                  </div>
                )}
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="mt-2">
                      <h4 className="truncate font-bold text-emerald-400" title={update.task_title}>
                        {update.task_title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {update.crop_name || update.livestock_name || t('N/A')}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-500 mt-2">
                      {new Date(update.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mb-3 text-sm font-medium text-slate-300">
                    <span className="text-slate-500">{t('Farmer:')}</span> {update.farmer_name}
                  </p>
                  <div className="mb-3 rounded-lg bg-white/5 p-3">
                    <p className="text-xs font-semibold text-slate-400 mb-1">{t('Manager Instructions:')}</p>
                    <p className="text-xs text-slate-300 line-clamp-2">{update.task_description || t('No instructions provided.')}</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-slate-400 mb-1">{t('Latest Update Notes:')}</p>
                    <p className="text-sm text-white/80 line-clamp-3">{update.notes || t('No additional notes provided.')}</p>
                  </div>
                </div>

                {update.image_url && (
                  <div className="relative mt-2 h-32 overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={update.image_url}
                      alt="Task update"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                      }}
                    />
                  </div>
                )}

                {isManager && (
                  <div className="mt-4">
                    <Button type="button" onClick={() => setSelectedUpdate(update)} className="w-full">
                      {t('View Details')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedUpdate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closeSelectedUpdate}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{t('Task Details')}</p>
                <h3 className="mt-2 text-3xl font-black text-white">{selectedUpdate.task_title}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedUpdate.crop_name || selectedUpdate.livestock_name || t('No related crop or livestock')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSelectedUpdate}
                className="rounded-full border border-white/10 px-3 py-1 text-slate-300 hover:bg-white/5"
              >
                ×
              </button>
            </div>

            {isManager && (normalizeStatus(selectedUpdate.task_status) === 'waiting_manager_approval' || normalizeStatus(selectedUpdate.task_status) === 'waiting_for_manager_approval') && (
              <Card title={t('Manager Review')} subtitle={t('Approve, reject, or request rework')} className="mb-6 border-violet-500/20 bg-violet-500/5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">{t('Reason / Notes')}</span>
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
                    placeholder={t('Add approval notes, rejection reason, or rework instructions')}
                  />
                </label>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => reviewTask('Approve')}
                    className="justify-center"
                  >
                    {t('Approve Task')}
                  </Button>
                  <Button
                    type="button"
                    disabled={reviewLoading}
                    variant="ghost"
                    onClick={() => reviewTask('Reject')}
                    className="justify-center !text-red-300"
                  >
                    {t('Reject Task')}
                  </Button>
                  <Button
                    type="button"
                    disabled={reviewLoading}
                    variant="ghost"
                    onClick={() => reviewTask('Request Rework')}
                    className="justify-center !text-amber-300"
                  >
                    {t('Request Rework')}
                  </Button>
                </div>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-1">
                <Card title={t('Task Summary')} subtitle={t('Start and finish details')}>
                  <div className="space-y-3 text-sm text-slate-300">
                    <Row label={t('Assigned Farmer')} value={selectedUpdate.farmer_name || t('N/A')} />
                    <Row label={t('Task Status')} value={String(selectedUpdate.task_status || 'N/A').replace(/_/g, ' ')} />
                    <Row label={t('Shift')} value={selectedUpdate.session ? String(selectedUpdate.session).toUpperCase() : t('N/A')} />
                    <Row label={t('Start Time')} value={selectedUpdate.started_at ? new Date(selectedUpdate.started_at).toLocaleString() : t('N/A')} />
                    {(() => {
                      const hundredPercentUpdate = updatesForSelectedTask.find(u => (u.progress_percentage || 0) >= 100) || updatesForSelectedTask[0];
                      let endTimeStr = selectedUpdate.completed_at ? new Date(selectedUpdate.completed_at).toLocaleString() : t('N/A');
                      let endTimeDate = selectedUpdate.completed_at ? new Date(selectedUpdate.completed_at) : null;
                      
                      if (!selectedUpdate.completed_at && hundredPercentUpdate && ((hundredPercentUpdate.progress_percentage || 0) >= 100 || normalizeStatus(selectedUpdate.task_status) === 'waiting_manager_approval')) {
                         endTimeStr = new Date(hundredPercentUpdate.created_at).toLocaleString();
                         endTimeDate = new Date(hundredPercentUpdate.created_at);
                      }

                      let workingHoursStr = selectedUpdate.working_hours ? String(selectedUpdate.working_hours) : t('N/A');
                      
                      if (selectedUpdate.started_at && endTimeDate && (!selectedUpdate.working_hours || selectedUpdate.working_hours == '0')) {
                         const start = new Date(selectedUpdate.started_at).getTime();
                         const end = endTimeDate.getTime();
                         const diffMs = end - start;
                         if (diffMs > 0) {
                            const hrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
                            workingHoursStr = `${hrs} hrs`;
                         }
                      }

                      return (
                        <>
                          <Row label={t('End Time')} value={endTimeStr} />
                          <Row label={t('Total Working Hours')} value={workingHoursStr} />
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">{t('Manager Instructions')}</p>
                    <p className="mt-2">{selectedUpdate.task_description || t('No instructions provided.')}</p>
                  </div>
                </Card>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <Card title={t('Worker Updates Timeline')} subtitle={t('All evidence submitted on this date')}>
                  <div className="space-y-6">
                    {updatesForSelectedTask.map((update, idx) => (
                      <div key={update.id} className="relative pl-6 border-l-2 border-emerald-500/30 pb-6 last:pb-0 last:border-l-0">
                        <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <div className="flex flex-col gap-4 sm:flex-row">
                          <div className="flex-1 rounded-2xl border border-white/5 bg-white/5 p-5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                  Update {updatesForSelectedTask.length - idx}
                                </span>
                                {(update.status === 'Rejected' || String(update.ai_explanation || '').toLowerCase().includes('duplicate') || String(update.notes || '').toLowerCase().includes('duplicate')) && (
                                  <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                                    Duplicate
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {new Date(update.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            {update.progress_percentage !== undefined && update.progress_percentage !== null && (
                               <div className="mb-3 text-xs font-semibold text-sky-300 uppercase tracking-widest">
                                  Progress: {update.progress_percentage}%
                                </div>
                            )}
                            <p className="text-sm leading-6 text-slate-300">
                              {update.notes || t('No notes were submitted.')}
                            </p>
                          </div>
                          
                          {(() => {
                            let parsedImages: any[] = [];
                            if (Array.isArray(update.images) && update.images.length > 0) {
                              parsedImages = update.images;
                            } else if (typeof update.images === 'string') {
                              try {
                                const parsed = JSON.parse(update.images);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                  parsedImages = parsed;
                                }
                              } catch (e) {}
                            }
                            if (parsedImages.length === 0 && update.image_url) {
                              parsedImages = [{ url: update.image_url }];
                            }

                             const isDuplicate = update.status === 'Rejected' || String(update.ai_explanation || '').toLowerCase().includes('duplicate') || String(update.notes || '').toLowerCase().includes('duplicate');

                             return (
                              <div className="w-full sm:w-64 shrink-0 grid grid-cols-2 gap-2">
                                {parsedImages.map((img, i) => (
                                  <div key={i} className={`relative overflow-hidden rounded-xl border border-white/10 ${parsedImages.length === 1 ? 'col-span-2' : ''}`}>
                                    <img
                                      src={img.url || img.path}
                                      alt={`Evidence ${i + 1} for ${update.task_title}`}
                                      className={`h-24 w-full object-cover transition-transform hover:scale-110 ${isDuplicate ? 'blur-xs opacity-60' : ''}`}
                                      onError={(e) => {
                                        e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                                      }}
                                    />
                                    {isDuplicate && (
                                      <div className="absolute inset-0 bg-rose-950/80 flex flex-col items-center justify-center p-1 text-center backdrop-blur-xs">
                                        <AlertTriangle className="h-4 w-4 text-rose-400 mb-1 animate-bounce" />
                                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-200">Duplicate</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-white">{value}</span>
    </div>
  );
}

