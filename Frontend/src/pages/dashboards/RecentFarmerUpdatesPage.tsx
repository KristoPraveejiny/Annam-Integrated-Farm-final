import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

type TaskUpdate = {
  id: string;
  task_id: string;
  task_title: string;
  task_description?: string | null;
  task_status?: string | null;
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

  const reviewTask = async (action: 'Approve' | 'Reject' | 'Rework') => {
    if (!selectedUpdate) return;
    if ((action === 'Reject' || action === 'Rework') && !reviewReason.trim()) {
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
    <div className="space-y-6 pb-20">
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
        ) : recentUpdates.length === 0 ? (
          <div className="py-8 text-center text-slate-500">{t('No recent updates.')}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentUpdates.map((update) => (
              <div key={update.id} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/40 p-5 shadow-lg">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="truncate font-bold text-emerald-400" title={update.task_title}>
                        {update.task_title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {update.crop_name || update.livestock_name || t('N/A')}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(update.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mb-1 text-sm font-medium text-slate-300">
                    <span className="text-slate-500">{t('Farmer:')}</span> {update.farmer_name}
                  </p>
                  <p className="mb-3 text-sm text-white/80 line-clamp-3">{update.notes || t('No additional notes provided.')}</p>
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

                {isManager && (normalizeStatus(update.task_status) === 'waiting_manager_approval' || normalizeStatus(update.task_status) === 'waiting_for_manager_approval') && (
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
                    onClick={() => reviewTask('Rework')}
                    className="justify-center !text-amber-300"
                  >
                    {t('Request Rework')}
                  </Button>
                </div>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <Card title={t('Progress Timeline')} subtitle={t('Start and finish details')}>
                  <div className="space-y-3 text-sm text-slate-300">
                    <Row label={t('Assigned Farmer')} value={selectedUpdate.farmer_name || t('N/A')} />
                    <Row label={t('Task Status')} value={String(selectedUpdate.task_status || 'N/A').replace(/_/g, ' ')} />
                    <Row label={t('Start Time')} value={selectedUpdate.started_at ? new Date(selectedUpdate.started_at).toLocaleString() : t('N/A')} />
                    <Row label={t('End Time')} value={selectedUpdate.completed_at ? new Date(selectedUpdate.completed_at).toLocaleString() : t('N/A')} />
                    <Row label={t('Total Working Hours')} value={selectedUpdate.working_hours ? String(selectedUpdate.working_hours) : t('N/A')} />
                  </div>
                </Card>

                <Card title={t('Completion Notes')} subtitle={t('Worker submission and supporting evidence')}>
                  <p className="text-sm leading-6 text-slate-300">
                    {selectedUpdate.notes || t('No notes were submitted.')}
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">{t('Manager Instructions')}</p>
                    <p className="mt-2">{selectedUpdate.task_description || t('No instructions provided.')}</p>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card title={t('Uploaded Evidence')} subtitle={t('Images shared by the farmer')}>
                  {selectedUpdate.image_url ? (
                    <img
                      src={selectedUpdate.image_url}
                      alt={selectedUpdate.task_title}
                      className="max-h-72 w-full rounded-2xl object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/640x360?text=Image+Not+Found';
                      }}
                    />
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-500">
                      {t('No image uploaded.')}
                    </div>
                  )}
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

