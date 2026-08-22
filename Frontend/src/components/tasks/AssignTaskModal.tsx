import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { FiFileText } from 'react-icons/fi';
import { apiFetch } from '../../utils/apiFetch';
import { LeaveAwareDatePicker } from '../ui/LeaveAwareDatePicker';
import { fetchWorkerLeaveDates } from '../../api/leave';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';

type AssignTaskModalProps = {
  mode: 'crop' | 'livestock';
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  farmers: any[];
  shifts: any[];
  relatedOptions: any[];
  prefill?: {
    title?: string;
    description?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    /** Disease report this task is being raised from, if any. */
    diseaseReportId?: string;
  };
};

const emptyFormData = {
  title: '',
  description: '',
  relatedId: '',
  assignedToUserId: '',
  priority: 'medium',
  session: 'morning',
  dueDate: '',
  attachmentUrl: '',
  attachmentName: '',
  diseaseReportId: ''
};

export function AssignTaskModal({ mode, open, onClose, onCreated, farmers, shifts, relatedOptions, prefill }: AssignTaskModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(emptyFormData);
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const todayDate = new Date().toISOString().split('T')[0];

  // Identity of the incoming prefill, so the form reloads when the manager
  // arrives from a different disease report even if the modal never closed.
  const prefillKey = [
    prefill?.diseaseReportId,
    prefill?.attachmentUrl,
    prefill?.title,
    prefill?.description
  ].join('|');

  // Whenever the chosen worker changes, load the days they are on approved
  // leave so those dates can be greyed out in the picker.
  useEffect(() => {
    let cancelled = false;
    const workerId = formData.assignedToUserId;

    if (!workerId) {
      setLeaveDates([]);
      return;
    }

    fetchWorkerLeaveDates(workerId)
      .then((result) => {
        if (cancelled) return;
        setLeaveDates(result.dates);
        // A date picked before the worker was chosen may now be on leave.
        if (formData.dueDate && result.dates.includes(formData.dueDate)) {
          setFormData((previous) => ({ ...previous, dueDate: '' }));
          notifyWarning('That date falls in this worker’s approved leave, so it was cleared.');
        }
      })
      .catch((err) => {
        console.error('Could not load leave dates', err);
        if (!cancelled) setLeaveDates([]);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.assignedToUserId]);

  useEffect(() => {
    if (open) {
      setFormData({
        ...emptyFormData,
        title: prefill?.title || '',
        description: prefill?.description || '',
        attachmentUrl: prefill?.attachmentUrl || '',
        attachmentName: prefill?.attachmentName || '',
        diseaseReportId: prefill?.diseaseReportId || ''
      });
    }
    // Keyed on the prefill contents, not just `open`: arriving from a second
    // disease report while the modal is already open would otherwise keep the
    // first report's details and link the task to the wrong report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillKey]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.dueDate && formData.dueDate < todayDate) {
      notifyWarning('Task date cannot be earlier than today.');
      return;
    }
    if (formData.dueDate && leaveDates.includes(formData.dueDate)) {
      notifyWarning('This worker is on approved leave that day. Choose another date or another worker.');
      return;
    }

    const selectedShift = shifts.find((shift) => {
      const shiftName = String(shift.shift_name || '').trim().toLowerCase();
      return shiftName === formData.session || String(shift.id || '').trim() === formData.session;
    });

    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          cropCycleId: mode === 'crop' ? formData.relatedId : undefined,
          livestockGroupId: mode === 'livestock' ? formData.relatedId : undefined,
          assignedToUserId: formData.assignedToUserId,
          priority: formData.priority,
          dueDate: formData.dueDate,
          attachmentUrl: formData.attachmentUrl,
          attachmentName: formData.attachmentName,
          diseaseReportId: formData.diseaseReportId || undefined,
          shiftId: selectedShift?.id,
          session: String(selectedShift?.shift_name || formData.session).trim().toLowerCase()
        })
      });

      if (res.ok) {
        onClose();
        setFormData(emptyFormData);
        onCreated();
        notifySuccess('Task assigned and email sent successfully!');
      } else {
        const errorData = await res.json();
        notifyError(errorData.error || 'Failed to create task');
      }
    } catch (err) {
      console.error('Submit error:', err);
      notifyError('An error occurred while saving.');
    }
  };

  const relatedLabel = mode === 'crop' ? t('Related Crop') : t('Related Livestock');
  const modalTitle = mode === 'crop' ? t('Assign New Crop Task') : t('Assign New Livestock Task');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <h3 className="text-2xl font-bold text-white mb-6">{modalTitle}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t("Task Title")}</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              placeholder={t("eg Inspect irrigation lines")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t("Description")}</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              placeholder={t("Details about the task")}
            />
          </div>

          {formData.attachmentUrl && (
            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <FiFileText size={18} />
                <span className="font-medium truncate max-w-[200px]">{formData.attachmentName || 'Attached Document'}</span>
              </div>
              <a href={formData.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:text-emerald-200 underline">
                {t("View")}
              </a>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t("Assign to Farmer")}</label>
            <select
              required
              value={formData.assignedToUserId}
              onChange={e => setFormData({ ...formData, assignedToUserId: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="" disabled>{t("Select farmer")}</option>
              {farmers.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{relatedLabel}</label>
            <select
              value={formData.relatedId}
              onChange={e => setFormData({ ...formData, relatedId: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">{t("None")}</option>
              {mode === 'crop'
                ? relatedOptions
                    .filter(c =>
                      String(c.status || '').toLowerCase() !== 'harvested' &&
                      String(c.status || '').toLowerCase() !== 'completed' &&
                      String(c.harvest_status || '').toLowerCase() !== 'harvested'
                    )
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.crop_name} {c.variety ? `(${c.variety})` : ''}</option>
                    ))
                : relatedOptions.map(lg => (
                    <option key={lg.id} value={lg.id}>{lg.group_code} - {lg.species}</option>
                  ))}
            </select>
            {mode === 'livestock' && relatedOptions.length === 0 ? (
              <p className="mt-1.5 text-xs text-amber-300">
                {t('No livestock groups have animals registered yet. Add an animal under the List tab first.')}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Session</label>
              <select
                value={formData.session}
                onChange={e => setFormData({ ...formData, session: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                {shifts.length > 0 ? (
                  shifts.map((shift) => (
                    <option key={shift.id} value={String(shift.shift_name || '').trim().toLowerCase()}>
                      {shift.shift_name}
                      {shift.start_time && shift.end_time ? ` (${String(shift.start_time).slice(0, 5)} - ${String(shift.end_time).slice(0, 5)})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="morning">Morning (Rs. 2000)</option>
                    <option value="afternoon">Afternoon (Rs. 2000)</option>
                    <option value="evening">Evening (Rs. 1000)</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('Due Date')}</label>
              <LeaveAwareDatePicker
                value={formData.dueDate}
                onChange={(date) => setFormData({ ...formData, dueDate: date })}
                min={todayDate}
                disabledDates={leaveDates}
                disabledReason={t('Worker is on approved leave')}
                placeholder={t('Select a date')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={onClose}>{t("Cancel")}</Button>
            <Button type="submit">{t("Create Task")}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
