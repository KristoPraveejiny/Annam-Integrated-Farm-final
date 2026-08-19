import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiClock } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess } from '../../utils/notifications';

export default function FarmerLivestockUpdatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await apiFetch('/api/tasks/farmer');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.filter((t: any) => !!t.livestock_group_id));
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch livestock tasks:', err);
      notifyError('Failed to load livestock tasks.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const normalizeTaskStatus = (status: string | undefined | null) =>
    String(status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  const getDisplayStatus = (task: any) => {
    const status = normalizeTaskStatus(task.status);
    if (status === 'approved' && (task.completion_percentage || 0) < 100) {
      return 'in_progress';
    }
    return status;
  };

  const isOverdue = (task: any) => {
    const status = getDisplayStatus(task);
    if (['approved', 'completed', 'done'].includes(status)) return false;
    return !!task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      if (status === 'in_progress') {
        const res = await apiFetch(`/api/tasks/${taskId}/start`, { method: 'PUT' });
        if (res.ok) {
          fetchTasks();
          notifySuccess('Task started successfully.');
        } else {
          notifyError('Failed to start task');
        }
        return;
      }

      if (status === 'done' || status === 'update') {
        navigate(`/dashboard/farmer-worker/tasks/${taskId}/activity`, { state: { isFinal: status === 'done' } });
        return;
      }
    } catch (err) {
      console.error('Update status error:', err);
      notifyError('Error updating task');
    }
  };

  const totalCount = tasks.length;
  const pendingCount = tasks.filter(t => getDisplayStatus(t) === 'pending').length;
  const completedCount = tasks.filter(t => ['approved', 'completed', 'done'].includes(getDisplayStatus(t))).length;
  const overdueCount = tasks.filter(t => getDisplayStatus(t) === 'rework_requested' || isOverdue(t)).length;

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t("Livestock Updates")}
        title={t("Livestock Tasks")}
        description={t("Review tasks assigned for your livestock and submit evidence to complete them.")}
        tone="light"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title={t("Total Tasks")}><p className="mt-2 text-4xl font-black text-white">{totalCount}</p></Card>
        <Card title={t("Pending")}><p className="mt-2 text-4xl font-black text-white">{pendingCount}</p></Card>
        <Card title={t("Completed")}><p className="mt-2 text-4xl font-black text-white">{completedCount}</p></Card>
        <Card title={t("Rework / Overdue")}><p className="mt-2 text-4xl font-black text-white">{overdueCount}</p></Card>
      </div>

      <Card title={t("Livestock Task List")} subtitle={t("Manage your assigned livestock tasks")}>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl mt-4">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">{t("Task Name")}</th>
                <th className="px-6 py-4">{t("Livestock Group")}</th>
                <th className="px-6 py-4">{t("Priority")}</th>
                <th className="px-6 py-4">{t("Due Date")}</th>
                <th className="px-6 py-4">{t("Status")}</th>
                <th className="px-6 py-4 text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/60">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">{t("Loading tasks...")}</td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">{t("No livestock tasks assigned.")}</td></tr>
              ) : (
                tasks.map(task => (
                  <tr key={task.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {t(task.title)}
                      {task.description && <p className="text-xs text-slate-400 font-normal mt-1">{task.description}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${task.completion_percentage || 0}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{task.completion_percentage || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{task.livestock_name || t('N/A')}</td>
                    <td className="px-6 py-4 capitalize">{t(task.priority)}</td>
                    <td className="px-6 py-4">{task.due_date ? new Date(task.due_date).toLocaleDateString() : t('N/A')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        getDisplayStatus(task) === 'approved' || getDisplayStatus(task) === 'completed' || getDisplayStatus(task) === 'done'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : getDisplayStatus(task) === 'in_progress'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : getDisplayStatus(task) === 'waiting_for_manager_approval' || getDisplayStatus(task) === 'waiting_manager_approval'
                              ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                              : getDisplayStatus(task) === 'rejected'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{String(getDisplayStatus(task)).replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      {getDisplayStatus(task) === 'pending' && (
                        <Button variant="ghost" onClick={() => updateTaskStatus(task.id, 'in_progress')} className="!p-2 text-blue-400 hover:text-blue-300" title="Start Task">
                          <FiClock className="mr-1 inline" /> {t("Start Work")}
                        </Button>
                      )}
                      {(getDisplayStatus(task) === 'in_progress' || (getDisplayStatus(task) === 'approved' && (task.completion_percentage || 0) < 100)) && (
                        <>
                          <Button variant="ghost" onClick={() => updateTaskStatus(task.id, 'update')} className="!p-2 text-blue-400 hover:text-blue-300" title="Update Progress">
                            <FiCheckCircle className="mr-1 inline" /> {t("Update")}
                          </Button>
                          <Button variant="ghost" onClick={() => updateTaskStatus(task.id, 'done')} className="!p-2 text-emerald-400 hover:text-emerald-300" title="Mark Complete">
                            <FiCheckCircle className="mr-1 inline" /> {t("Complete")}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
