import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useTranslation } from 'react-i18next';
import { deleteFeedback, getAdminFeedback, updateFeedbackStatus } from '../../../api/feedback';

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
    await updateFeedbackStatus(id, 'visible');
    await fetchFeedback();
  };

  const hide = async (id: string) => {
    await updateFeedbackStatus(id, 'hidden');
    await fetchFeedback();
  };

  const remove = async (id: string) => {
    await deleteFeedback(id);
    await fetchFeedback();
  };

  const counts = useMemo(() => ({
    all: feedback.length,
    customer: feedback.filter((item) => item.user_role === 'Customer').length,
    farmer: feedback.filter((item) => item.user_role === 'Farmer').length,
  }), [feedback]);

  return (
    <div className="space-y-6">
      <Card title={t("Feedback Management")} subtitle={t("Review, approve, hide, or remove customer and farmer feedback.")} variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
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
              <option key={value} value={value}>{value} Stars</option>
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-950/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Status</th>
                    {!readOnly ? <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-300">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/30">
                  {feedback.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-white">{item.user_name}</td>
                      <td className="px-6 py-4 text-slate-300">{item.user_role}</td>
                      <td className="px-6 py-4 text-slate-300 capitalize">{item.feedback_type}</td>
                      <td className="px-6 py-4 text-slate-300">{'★'.repeat(item.rating)}</td>
                      <td className="px-6 py-4 text-slate-200 max-w-md">{item.message}</td>
                      <td className="px-6 py-4 text-slate-300">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-slate-300 capitalize">{item.status}</td>
                      {!readOnly ? (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => approve(item.id)} className="text-emerald-300">{t("Approve")}</Button>
                            <Button variant="ghost" onClick={() => hide(item.id)} className="text-amber-300">{t("Hide")}</Button>
                            <Button variant="ghost" onClick={() => remove(item.id)} className="text-rose-300">{t("Delete")}</Button>
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
