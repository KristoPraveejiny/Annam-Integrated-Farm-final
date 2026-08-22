import { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiXCircle, FiClock, FiAlertTriangle, FiUser } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';
import { fetchFarmLeaveRequests, reviewLeaveRequest, type LeaveRequest } from '../../api/leave';

const STATUS_FILTERS = ['Pending', 'Approved', 'Rejected', 'all'] as const;

const statusStyles: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Rejected: 'bg-red-500/10 text-red-300 border-red-500/30',
  Cancelled: 'bg-slate-500/10 text-slate-300 border-slate-500/30'
};

const dayCount = (request: LeaveRequest) => {
  if (typeof request.total_days === 'number') return request.total_days;
  const from = new Date(request.start_date);
  const to = new Date(request.end_date);
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
};

export default function LeaveManagementPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('Pending');
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [working, setWorking] = useState(false);

  const load = async (status = filter) => {
    setLoading(true);
    try {
      setRequests(await fetchFarmLeaveRequests(status));
    } catch (err) {
      console.error('Failed to load leave requests', err);
      notifyError('Could not load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'Pending').length,
    approved: requests.filter((r) => r.status === 'Approved').length,
    rejected: requests.filter((r) => r.status === 'Rejected').length
  }), [requests]);

  const decide = async (status: 'Approved' | 'Rejected') => {
    if (!selected) return;
    setWorking(true);
    try {
      const result = await reviewLeaveRequest(selected.id, status, managerNotes.trim() || undefined);
      notifySuccess(`Leave ${status.toLowerCase()}. The worker has been notified.`);

      // Approving leave over days that already carry work is allowed, but the
      // manager needs to know so those tasks can be moved or reassigned.
      const clashes = result.conflictingTasks || [];
      if (status === 'Approved' && clashes.length > 0) {
        notifyWarning(
          `${clashes.length} task(s) are already scheduled for this worker during that leave: ${clashes
            .map((task) => task.title)
            .join(', ')}. Please reassign or reschedule them.`
        );
      }

      setSelected(null);
      setManagerNotes('');
      load(filter);
    } catch (err: any) {
      notifyError(err.message || 'Could not update the request.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t('Workforce')}
        title={t('Leave Management')}
        description={t('Review time-off requests from your farm workers.')}
        tone="light"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Awaiting Your Decision')}</p>
          <p className="mt-2 text-4xl font-black text-amber-400">{counts.pending}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Approved')}</p>
          <p className="mt-2 text-4xl font-black text-emerald-400">{counts.approved}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Rejected')}</p>
          <p className="mt-2 text-4xl font-black text-red-400">{counts.rejected}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-white/10 pb-4">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold capitalize transition-all ${
              filter === status
                ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
                : 'border border-white/5 bg-slate-900/50 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {status === 'all' ? t('All') : t(status)}
          </button>
        ))}
      </div>

      <Card title={t('Leave Requests')} subtitle={t('Approving leave blocks that worker from being assigned tasks on those days')}>
        {loading ? (
          <div className="py-8 text-center text-slate-400">{t('Loading...')}</div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-slate-500">{t('No leave requests to show.')}</div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 font-semibold text-white">
                <tr>
                  <th className="px-6 py-4">{t('Worker')}</th>
                  <th className="px-6 py-4">{t('Dates')}</th>
                  <th className="px-6 py-4">{t('Days')}</th>
                  <th className="px-6 py-4">{t('Status')}</th>
                  <th className="px-6 py-4 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/60">
                {requests.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <FiUser className="text-slate-500" />
                        {request.worker_name}
                      </div>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-400" title={request.reason}>
                        {request.reason}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(request.start_date).toLocaleDateString()}
                      <span className="mx-1 text-slate-600">&rarr;</span>
                      {new Date(request.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">{dayCount(request)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusStyles[request.status]}`}>
                        {request.status === 'Approved' && <FiCheckCircle className="mr-1 inline" />}
                        {request.status === 'Rejected' && <FiXCircle className="mr-1 inline" />}
                        {request.status === 'Pending' && <FiClock className="mr-1 inline" />}
                        {t(request.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        className="!py-1 text-xs"
                        onClick={() => {
                          setSelected(request);
                          setManagerNotes(request.manager_notes || '');
                        }}
                      >
                        {request.status === 'Pending' ? t('Review') : t('View')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-1 text-2xl font-bold text-white">{t('Leave Request')}</h3>
            <p className="mb-6 text-sm text-slate-400">{selected.worker_name}</p>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">{t('Dates')}</dt>
                <dd className="text-right font-semibold text-white">
                  {new Date(selected.start_date).toLocaleDateString()} &rarr; {new Date(selected.end_date).toLocaleDateString()}
                  <span className="ml-2 text-slate-400">({dayCount(selected)} {t('days')})</span>
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-slate-400">{t('Reason')}</dt>
                <dd className="whitespace-pre-line rounded-xl bg-white/5 p-3 text-slate-200">{selected.reason}</dd>
              </div>
            </dl>

            {selected.status === 'Pending' ? (
              <>
                <label className="mt-6 block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t('Notes for the worker (optional)')}</span>
                  <textarea
                    className="farm-input min-h-24 w-full"
                    placeholder={t('Explain your decision...')}
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                  />
                </label>

                <p className="mt-4 flex items-start gap-2 text-xs text-amber-300">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  {t('Approving this blocks new task assignments for this worker on those dates.')}
                </p>

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSelected(null)}>{t('Close')}</Button>
                  <Button
                    variant="outline"
                    disabled={working}
                    className="border-red-500/30 bg-red-600/20 text-red-300 hover:bg-red-600/30"
                    onClick={() => decide('Rejected')}
                  >
                    <FiXCircle className="mr-1 inline" /> {t('Reject')}
                  </Button>
                  <Button disabled={working} onClick={() => decide('Approved')}>
                    <FiCheckCircle className="mr-1 inline" /> {t('Approve')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {selected.manager_notes && (
                  <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                    <span className="font-semibold text-emerald-300">{t('Your notes')}: </span>
                    {selected.manager_notes}
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-500">
                  {t('Reviewed by')} {selected.reviewed_by_name || t('manager')}
                  {selected.reviewed_at ? ` · ${new Date(selected.reviewed_at).toLocaleString()}` : ''}
                </p>
                <div className="mt-6 flex justify-end">
                  <Button variant="ghost" onClick={() => setSelected(null)}>{t('Close')}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
