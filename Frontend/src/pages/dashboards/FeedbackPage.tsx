import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiClock, FiMessageSquare, FiStar } from 'react-icons/fi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { useTranslation } from 'react-i18next';
import { getMyFeedback, submitFeedback } from '../../api/feedback';

type FeedbackRole = 'customer' | 'farmer-worker';

type FeedbackItem = {
  id: string;
  user_name?: string;
  user_role: string;
  feedback_type: string;
  rating: number;
  message: string;
  status: string;
  created_at: string;
};

export default function FeedbackPage({ role }: { role: FeedbackRole }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState(role === 'customer' ? 'product' : 'system');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allowed = useMemo(() => role === 'customer' || role === 'farmer-worker', [role]);

  useEffect(() => {
    void fetchMyFeedback();
  }, []);

  const fetchMyFeedback = async () => {
    try {
      setLoading(true);
      const data = await getMyFeedback();
      setItems(data);
    } catch {
      setError('Failed to load feedback history.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!allowed) return;
    try {
      setSaving(true);
      setError('');
      await submitFeedback({ rating, message, feedback_type: feedbackType });
      setMessage('');
      setRating(5);
      await fetchMyFeedback();
    } catch (submitError: any) {
      setError(submitError?.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={t("Feedback")}
        title={role === 'customer' ? t("Customer Feedback") : t("Farmer Feedback")}
        description={role === 'customer'
          ? t("Share your thoughts on marketplace experience, orders, and delivery.")
          : t("Share your experience with crop management, tasks, livestock, and AI advice.")}
        tone="light"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<FiMessageSquare />} label={t("Submitted")} value={String(items.length)} />
        <MetricCard icon={<FiClock />} label={t("Pending")} value={String(items.filter((item) => item.status === 'pending').length)} />
        <MetricCard icon={<FiCheckCircle />} label={t("Visible")} value={String(items.filter((item) => item.status === 'visible').length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        {allowed ? (
          <Card
            title={t("Submit Feedback")}
            subtitle={t("Your feedback is sent to the super admin for review.")}
            variant="dark"
            className="border-white/10 bg-white/[0.08] backdrop-blur-2xl"
          >
            <div className="mb-5 rounded-[1.35rem] border border-emerald-400/15 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">{t("Tell us what worked well and what we can improve.")}</p>
              <p className="mt-1 text-xs leading-6 text-emerald-100/70">
                {role === 'customer'
                  ? t("Your feedback helps improve products, orders, and delivery.")
                  : t("Your feedback helps improve farm operations, tasks, and AI guidance.")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t("Feedback Type")}</span>
                <select className="farm-input rounded-2xl" value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)}>
                  {role === 'customer' ? (
                    <>
                      <option value="product">Product / Marketplace</option>
                      <option value="order">Order Process</option>
                      <option value="delivery">Delivery Service</option>
                      <option value="experience">Overall Experience</option>
                    </>
                  ) : (
                    <>
                      <option value="system">System Usability</option>
                      <option value="crop">Crop Management</option>
                      <option value="task">Task Assignment</option>
                      <option value="livestock">Livestock Management</option>
                      <option value="ai">AI Advisory</option>
                    </>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t("Rating")}</span>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = rating >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-bold transition duration-200 ${
                          active
                            ? 'border-amber-300/30 bg-amber-400/15 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]'
                            : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20 hover:bg-white/5'
                        }`}
                        aria-label={`Rate ${value} out of 5`}
                      >
                        <FiStar className={active ? 'fill-current' : ''} />
                      </button>
                    );
                  })}
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t("Message")}</span>
                <textarea
                  className="farm-input min-h-44 rounded-2xl"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("Write your feedback here...")}
                  required
                />
              </label>

              {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? t("Submitting...") : t("Submit Feedback")}
              </Button>
            </form>
          </Card>
        ) : null}

        <Card
          title={t("My Feedback History")}
          subtitle={t("Track submitted feedback and its review status.")}
          variant="dark"
          className="border-white/10 bg-white/[0.08] backdrop-blur-2xl"
        >
          {loading ? (
            <p className="text-slate-300">{t("Loading...")}</p>
          ) : items.length === 0 ? (
            <div className="grid place-items-center rounded-[1.35rem] border border-dashed border-white/10 bg-slate-950/25 px-6 py-14 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-300">
                <FiMessageSquare className="text-2xl" />
              </div>
              <p className="mt-4 text-base font-semibold text-white">{t("No feedback submitted yet.")}</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                {t("Your submitted feedback will appear here with its review status.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-4 shadow-[0_12px_35px_rgba(2,6,23,0.16)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold capitalize text-white">{item.feedback_type}</p>
                      <p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      item.status === 'visible'
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : item.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-200'
                          : 'bg-white/10 text-slate-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                    <span className="flex items-center gap-1 text-amber-300">
                      {'★'.repeat(item.rating)}
                      <span className="text-slate-500">{'☆'.repeat(5 - item.rating)}</span>
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.user_role}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] px-5 py-4 shadow-[0_12px_35px_rgba(2,6,23,0.14)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-200">
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
