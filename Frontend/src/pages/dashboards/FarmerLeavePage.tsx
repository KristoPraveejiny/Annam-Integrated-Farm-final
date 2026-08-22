import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiSend } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess } from '../../utils/notifications';
import {
  submitLeaveRequest,
  fetchMyLeaveRequests,
  cancelLeaveRequest,
  type LeaveRequest
} from '../../api/leave';

const today = () => new Date().toISOString().split('T')[0];

const statusStyles: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Rejected: 'bg-red-500/10 text-red-300 border-red-500/30',
  Cancelled: 'bg-slate-500/10 text-slate-300 border-slate-500/30'
};

const countDays = (start: string, end: string) => {
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
};

export default function FarmerLeavePage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const loadRequests = async () => {
    try {
      setRequests(await fetchMyLeaveRequests());
    } catch (err) {
      console.error('Failed to load leave requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const totalDays = startDate && endDate ? countDays(startDate, endDate) : 0;

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return notifyError('Please choose both dates.');
    if (new Date(endDate) < new Date(startDate)) return notifyError('End date cannot be before the start date.');
    if (reason.trim().length < 10) return notifyError('Please give a reason of at least 10 characters.');

    setSubmitting(true);
    try {
      await submitLeaveRequest({ startDate, endDate, reason: reason.trim() });
      notifySuccess('Leave request sent to your farm manager.');
      resetForm();
      loadRequests();
    } catch (err: any) {
      notifyError(err.message || 'Could not submit your leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelLeaveRequest(id);
      notifySuccess('Leave request withdrawn.');
      loadRequests();
    } catch (err: any) {
      notifyError(err.message || 'Could not withdraw the request.');
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t('Leave')}
        title={t('Leave Requests')}
        description={t('Ask your farm manager for time off and follow the status of your requests.')}
        tone="light"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Awaiting Decision')}</p>
          <p className="mt-2 text-4xl font-black text-amber-400">{pendingCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Approved')}</p>
          <p className="mt-2 text-4xl font-black text-emerald-400">{approvedCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('Total Requests')}</p>
          <p className="mt-2 text-4xl font-black text-white">{requests.length}</p>
        </Card>
      </div>

      <Card title={t('Request Leave')} subtitle={t('Your manager is notified as soon as you send this')}>
        <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t('From')}</span>
              <input
                type="date"
                className="farm-input w-full"
                min={today()}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // Keep the range valid rather than letting the user submit a
                  // backwards one and get an error.
                  if (endDate && e.target.value && endDate < e.target.value) setEndDate(e.target.value);
                }}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t('To')}</span>
              <input
                type="date"
                className="farm-input w-full"
                min={startDate || today()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </label>
          </div>

          {totalDays > 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <FiCalendar />
              {t('You are asking for')} <span className="font-bold">{totalDays}</span> {totalDays === 1 ? t('day') : t('days')}
            </p>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-white/80">{t('Reason')}</span>
            <textarea
              className="farm-input min-h-28 w-full"
              placeholder={t('Tell your manager why you need this leave...')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-slate-500">{reason.trim().length} / 10 {t('characters minimum')}</span>
          </label>

          <Button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 sm:w-auto">
            <FiSend /> {submitting ? t('Sending...') : t('Send Request')}
          </Button>
        </form>
      </Card>

      <Card title={t('My Leave History')} subtitle={t('Every request you have sent')}>
        {loading ? (
          <div className="py-8 text-center text-slate-400">{t('Loading...')}</div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-slate-500">{t('You have not requested any leave yet.')}</div>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{t('Leave')}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyles[request.status]}`}>
                      {request.status === 'Approved' && <FiCheckCircle className="mr-1 inline" />}
                      {request.status === 'Rejected' && <FiXCircle className="mr-1 inline" />}
                      {request.status === 'Pending' && <FiClock className="mr-1 inline" />}
                      {t(request.status)}
                    </span>
                  </div>
                  {request.status === 'Pending' && (
                    <Button variant="ghost" className="!py-1 text-xs text-red-300" onClick={() => handleCancel(request.id)}>
                      {t('Withdraw')}
                    </Button>
                  )}
                </div>

                <p className="mt-2 text-sm text-slate-300">
                  {new Date(request.start_date).toLocaleDateString()} &rarr; {new Date(request.end_date).toLocaleDateString()}
                  <span className="ml-2 text-slate-500">
                    ({countDays(request.start_date, request.end_date)} {t('days')})
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-400">{request.reason}</p>

                {request.manager_notes && (
                  <p className="mt-2 rounded-lg bg-white/5 p-2 text-xs text-slate-300">
                    <span className="font-semibold text-emerald-300">{t('Manager')}: </span>
                    {request.manager_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
