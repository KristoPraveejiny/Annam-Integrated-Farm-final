import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { FiSearch, FiInbox, FiMessageCircle, FiCheckCircle, FiSend, FiTrash2, FiX, FiChevronRight, FiMail, FiPhone, FiUser, FiFileText } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess, notifyWarning } from '../../../utils/notifications';
import {
  getContactMessages,
  getContactMessageById,
  updateContactMessageStatus,
  replyToContactMessage,
  deleteContactMessage,
  type ContactMessage,
  type ContactReply,
  type ContactCounts,
  type ContactStatus,
} from '../../../api/contact';

const STATUS_OPTIONS: ContactStatus[] = ['new', 'contacted', 'resolved', 'closed'];

const EMPTY_COUNTS: ContactCounts = { total: 0, new: 0, contacted: 0, resolved: 0, closed: 0 };

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || '').toLowerCase();
  const styles: Record<string, string> = {
    new: 'bg-amber-500/15 text-amber-200 ring-amber-400/25',
    contacted: 'bg-sky-500/15 text-sky-200 ring-sky-400/25',
    resolved: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/25',
    closed: 'bg-slate-500/15 text-slate-300 ring-slate-400/25',
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
        styles[normalized] ?? 'bg-slate-500/15 text-slate-200 ring-slate-400/25'
      }`}
    >
      {normalized || 'unknown'}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-emerald-300">{icon}</span>
      </div>
      <p className="mt-3 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs text-emerald-300/80">{hint}</p>
    </div>
  );
}

export default function ContactInquiriesPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [counts, setCounts] = useState<ContactCounts>(EMPTY_COUNTS);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<(ContactMessage & { replies: ContactReply[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState<ContactStatus>('new');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ContactMessage | null>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await getContactMessages({ search });
      setMessages(data.messages || []);
      setCounts(data.counts || EMPTY_COUNTS);
    } catch (err) {
      console.error('Failed to load contact messages:', err);
      notifyError(err instanceof Error ? err.message : 'Failed to load enquiries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchMessages();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openMessage = async (id: string) => {
    try {
      setDetailLoading(true);
      const data = await getContactMessageById(id);
      setSelected(data);
      setStatusDraft(data.status);
      setReplyText('');
    } catch (err) {
      console.error('Failed to load enquiry:', err);
      notifyError(err instanceof Error ? err.message : 'Failed to load enquiry.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelected(null);
    setReplyText('');
  };

  const handleSaveStatus = async () => {
    if (!selected || statusDraft === selected.status) {
      closeModal();
      return;
    }
    try {
      setSavingStatus(true);
      await updateContactMessageStatus(selected.id, statusDraft);
      notifySuccess('Status updated successfully.');
      closeModal();
      await fetchMessages();
    } catch (err) {
      console.error('Failed to update status:', err);
      notifyError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSendReply = async () => {
    if (!selected) return;
    if (!replyText.trim()) {
      notifyWarning('Please write a reply before sending.');
      return;
    }
    try {
      setSending(true);
      const result = await replyToContactMessage(selected.id, replyText.trim());
      notifySuccess(result.message || `Reply sent to ${selected.email}.`);
      setReplyText('');
      await openMessage(selected.id);
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send reply:', err);
      notifyError(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteContactMessage(pendingDelete.id);
      notifySuccess('Enquiry deleted successfully.');
      if (selected?.id === pendingDelete.id) closeModal();
      setPendingDelete(null);
      await fetchMessages();
    } catch (err) {
      console.error('Failed to delete enquiry:', err);
      notifyError(err instanceof Error ? err.message : 'Failed to delete enquiry.');
      setPendingDelete(null);
    }
  };

  const statCards = useMemo(
    () => [
      { label: t('Total Enquiries'), value: counts.total, hint: t('All time'), icon: <FiInbox /> },
      { label: t('New'), value: counts.new, hint: t('Awaiting first contact'), icon: <FiMail /> },
      { label: t('Contacted'), value: counts.contacted, hint: t('Follow-up in progress'), icon: <FiMessageCircle /> },
    ],
    [counts, t],
  );

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t('Communications')}
        title={t('Enquiries')}
        description={t('Enquiries submitted through the website contact form. Follow them up and keep their status current.')}
        tone="light"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} icon={card.icon} />
        ))}
      </div>

      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        <div className="relative mb-6">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Search by name, email or phone')}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-11 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500"
          />
        </div>

        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/30">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-slate-950/85">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Name')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Email')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Phone')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Subject')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Submitted')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Status')}</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/20">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">{t('Loading enquiries...')}</td></tr>
              ) : messages.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">{t('No enquiries found.')}</td></tr>
              ) : (
                messages.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-5 font-semibold text-white">{item.full_name}</td>
                    <td className="px-6 py-5 text-emerald-300">{item.email}</td>
                    <td className="px-6 py-5 text-slate-300">{item.phone || '—'}</td>
                    <td className="px-6 py-5 text-slate-200">
                      <div className="max-w-[18rem] truncate" title={item.subject}>{item.subject}</div>
                      {Number(item.reply_count || 0) > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-sky-300">
                          <FiSend className="text-[10px]" /> {item.reply_count} {t('reply sent')}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-5 text-slate-300">{formatDateTime(item.created_at)}</td>
                    <td className="px-6 py-5"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => openMessage(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        {t('View')} <FiChevronRight />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            {detailLoading || !selected ? (
              <div className="p-10 text-center text-slate-300">{t('Loading enquiry...')}</div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                  <h3 className="text-2xl font-bold text-white">{t('Enquiry')}</h3>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="space-y-6 px-6 py-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={selected.status} />
                    <span className="text-sm text-slate-400">
                      {t('Submitted')} {formatDateTime(selected.created_at)}
                    </span>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t('Contact Details')}</p>
                    <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 sm:grid-cols-2">
                      <Detail icon={<FiUser />} label={t('Full name')} value={selected.full_name} />
                      <Detail icon={<FiFileText />} label={t('Subject')} value={selected.subject} />
                      <Detail icon={<FiMail />} label={t('Email')} value={selected.email} accent />
                      <Detail icon={<FiPhone />} label={t('Phone')} value={selected.phone || '—'} accent={Boolean(selected.phone)} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t('Message')}</p>
                    <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm leading-relaxed text-slate-200">
                      {selected.message}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t('Status')}</p>
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as ContactStatus)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none focus:border-emerald-500"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option} className="capitalize">
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selected.replies.length > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t('Previous Replies')}</p>
                      <div className="space-y-3">
                        {selected.replies.map((reply) => (
                          <div key={reply.id} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-emerald-200">
                                {reply.replied_by_name || t('Admin')}
                              </span>
                              <span className="text-slate-400">{formatDateTime(reply.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-slate-200">{reply.reply_message}</p>
                            {!reply.email_sent && (
                              <p className="mt-2 text-xs font-semibold text-amber-300">{t('Email delivery failed')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t('Reply')}</p>
                    <p className="mb-3 text-xs text-slate-500">
                      {t('This message will be emailed to')} <span className="text-emerald-300">{selected.email}</span>
                    </p>
                    <textarea
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder={t('Write your reply to this enquiry...')}
                      className="min-h-[130px] w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500"
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sending || !replyText.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiSend /> {sending ? t('Sending...') : t('Send')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-5">
                  <button
                    type="button"
                    onClick={() => setPendingDelete(selected)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25"
                  >
                    <FiTrash2 /> {t('Delete')}
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {t('Close')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStatus}
                      disabled={savingStatus}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <FiCheckCircle /> {savingStatus ? t('Saving...') : t('Save changes')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('Delete enquiry?')}
        description={
          pendingDelete
            ? `${t('Are you sure you want to delete the enquiry from')} ${pendingDelete.full_name}? ${t('This cannot be undone.')}`
            : ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-emerald-300">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`mt-1 break-words font-semibold ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}
