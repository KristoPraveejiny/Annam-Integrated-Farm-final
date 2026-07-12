import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { deleteFeedback, getAdminFeedback, updateFeedbackStatus } from '../../../api/feedback';
import { notifyError, notifySuccess } from '../../../utils/notifications';

type FeedbackItem = {
  id: string;
  user_name: string;
  user_role: string;
  feedback_type: string;
  rating: number;
  message: string;
  status: string;
  created_at: string;
};

export default function FeedbackManagementPage({ readOnly = false }: { readOnly?: boolean }) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  useEffect(() => {
    void fetchFeedback();
  }, [roleFilter, typeFilter, ratingFilter]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminFeedback({ role: roleFilter, feedback_type: typeFilter, rating: ratingFilter });
      setFeedback(data);
    } catch {
      setError('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await updateFeedbackStatus(id, 'visible');
      await fetchFeedback();
      notifySuccess('Feedback approved successfully.');
    } catch {
      notifyError('Failed to update feedback.');
    }
  };

  const hide = async (id: string) => {
    try {
      await updateFeedbackStatus(id, 'hidden');
      await fetchFeedback();
      notifySuccess('Feedback hidden successfully.');
    } catch {
      notifyError('Failed to update feedback.');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteFeedback(id);
      await fetchFeedback();
      notifySuccess('Feedback deleted successfully.');
    } catch {
      notifyError('Failed to delete feedback.');
    }
  };

  const counts = useMemo(
    () => ({
      all: feedback.length,
      customer: feedback.filter((item) => item.user_role === 'Customer').length,
      farmer: feedback.filter((item) => item.user_role === 'Farmer').length,
    }),
    [feedback],
  );

  return (
    <div className="space-y-6">
      <Card
        title={t('Feedback Management')}
        subtitle={t('Review, approve, hide, or remove customer and farmer feedback.')}
        variant="dark"
        className="border-white/10 bg-white/[0.08] backdrop-blur-2xl"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="All Feedback" value={String(counts.all)} />
          <Metric label="Customer Feedback" value={String(counts.customer)} />
          <Metric label="Farmer Feedback" value={String(counts.farmer)} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <select className="farm-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All Feedback</option>
            <option value="Customer">Customer Feedback</option>
            <option value="Farmer">Farmer Feedback</option>
          </select>
          <select className="farm-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All Types</option>
            <option value="product">Product</option>
            <option value="system">System</option>
            <option value="order">Order</option>
            <option value="delivery">Delivery</option>
            <option value="experience">Experience</option>
            <option value="crop">Crop</option>
            <option value="task">Task</option>
            <option value="livestock">Livestock</option>
            <option value="ai">AI</option>
          </select>
          <select className="farm-input" value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
            <option value="all">All Ratings</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} Stars
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? <p className="text-slate-300">Loading feedback...</p> : null}
        {error ? <p className="text-rose-400">{error}</p> : null}
        {!loading && !error ? (
          feedback.length === 0 ? (
            <p className="text-slate-300">No feedback found.</p>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/30">
              <table className="min-w-full table-fixed divide-y divide-white/10">
                <thead className="bg-slate-950/85">
                  <tr>
                    <th className="w-40 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">User</th>
                    <th className="w-28 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Role</th>
                    <th className="w-28 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Type</th>
                    <th className="w-28 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Rating</th>
                    <th className="w-[34rem] px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Message</th>
                    <th className="w-32 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Date</th>
                    <th className="w-28 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Status</th>
                    {!readOnly ? (
                      <th className="w-56 px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/20">
                  {feedback.map((item) => (
                    <tr key={item.id} className="align-top transition-colors hover:bg-white/5">
                      <td className="px-6 py-5 text-white">
                        <div className="font-semibold">{item.user_name}</div>
                      </td>
                      <td className="px-6 py-5 text-slate-300">
                        <span className="inline-flex rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-inset ring-cyan-400/20">
                          {item.user_role}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-300 capitalize">{item.feedback_type}</td>
                      <td className="px-6 py-5 text-amber-300">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold tracking-wide">
                          {renderStars(item.rating)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-200">
                        <div className="max-w-[34rem] whitespace-normal break-words leading-7 text-slate-100">
                          {item.message}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-300">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-5">
                        <StatusBadge status={item.status} />
                      </td>
                      {!readOnly ? (
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <ActionButton color="emerald" onClick={() => approve(item.id)}>
                              {t('Approve')}
                            </ActionButton>
                            <ActionButton color="amber" onClick={() => hide(item.id)}>
                              {t('Hide')}
                            </ActionButton>
                            <ActionButton color="rose" onClick={() => remove(item.id)}>
                              {t('Delete')}
                            </ActionButton>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function renderStars(rating: number) {
  return `${'★'.repeat(rating)}${'☆'.repeat(Math.max(0, 5 - rating))}`;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles: Record<string, string> = {
    visible: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20',
    pending: 'bg-amber-500/15 text-amber-200 ring-amber-400/20',
    hidden: 'bg-rose-500/15 text-rose-200 ring-rose-400/20',
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
        styles[normalized] ?? 'bg-slate-500/15 text-slate-200 ring-slate-400/20'
      }`}
    >
      {status}
    </span>
  );
}

function ActionButton({
  children,
  color,
  onClick,
}: {
  children: React.ReactNode;
  color: 'emerald' | 'amber' | 'rose';
  onClick: () => void;
}) {
  const styles: Record<'emerald' | 'amber' | 'rose', string> = {
    emerald: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
    amber: 'border-amber-400/25 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
    rose: 'border-rose-400/25 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${styles[color]}`}
    >
      {children}
    </button>
  );
}
