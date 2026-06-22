import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiClock, FiMessageSquare } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export default function FarmerTasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Crop update modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCropCycleId, setSelectedCropCycleId] = useState<string | null>(null);
  const [cropFormData, setCropFormData] = useState({
    growthStage: '',
    healthScore: '',
    moistureScore: '',
    pestRisk: '',
    notes: ''
  });

  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchTasks = async () => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const [tasksRes, notifRes] = await Promise.all([
        fetch('/api/tasks/farmer', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data);
      }
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setLoading(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking as read', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const updateTaskStatus = async (taskId: string, status: string, cropCycleId?: string) => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        if (status === 'done' && cropCycleId) {
          setSelectedTaskId(taskId);
          setSelectedCropCycleId(cropCycleId);
          setShowCropModal(true);
        } else {
          fetchTasks();
        }
      } else {
        alert('Failed to update task status');
      }
    } catch (err) {
      console.error('Update status error:', err);
      alert('Error updating task');
    }
  };

  const handleCropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch('/api/crop-observations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cropCycleId: selectedCropCycleId,
          ...cropFormData
        })
      });

      if (res.ok) {
        setShowCropModal(false);
        setCropFormData({ growthStage: '', healthScore: '', moistureScore: '', pestRisk: '', notes: '' });
        alert('Crop observation submitted successfully!');
        fetchTasks();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to submit crop observation');
      }
    } catch (err) {
      console.error('Submit crop error:', err);
      alert('Error submitting observation');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading eyebrow={t("My Tasks")} title={t("Assigned Tasks")} description={t("View and update your daily farm operations.")} tone="light" />



      <Card title={t("Task List")} subtitle={t("Manage your ongoing tasks")}>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl mt-4">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">{t("Task Name")}</th>
                <th className="px-6 py-4">{t("Crop")}</th>
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
                <tr><td colSpan={6} className="px-6 py-4 text-center">{t("No tasks assigned.")}</td></tr>
              ) : (
                tasks.map(task => (
                  <tr key={task.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {t(task.title)}
                      {task.description && <p className="text-xs text-slate-400 font-normal mt-1">{task.description}</p>}
                    </td>
                    <td className="px-6 py-4">{task.crop_name || t('N/A')}</td>
                    <td className="px-6 py-4 capitalize">{t(task.priority)}</td>
                    <td className="px-6 py-4">{task.due_date ? new Date(task.due_date).toLocaleDateString() : t('N/A')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{task.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      {task.status === 'todo' && (
                        <Button variant="ghost" onClick={() => updateTaskStatus(task.id, 'in_progress')} className="!p-2 text-blue-400 hover:text-blue-300" title="Start Task">
                          <FiClock className="mr-1 inline" /> {t("Start")}
                        </Button>
                      )}
                      {(task.status === 'todo' || task.status === 'in_progress') && (
                        <Button variant="ghost" onClick={() => updateTaskStatus(task.id, 'done', task.crop_cycle_id)} className="!p-2 text-emerald-400 hover:text-emerald-300" title="Mark Complete">
                          <FiCheckCircle className="mr-1 inline" /> {t("Complete")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Crop Observation Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-white mb-6">{t("Task Completed! Update Crop Status?")}</h3>
            <p className="text-slate-300 mb-4 text-sm">{t("Since this task is related to a crop, you can log an observation now.")}</p>
            <form onSubmit={handleCropSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Growth Stage")}</label>
                <input
                  type="text"
                  value={cropFormData.growthStage}
                  onChange={e => setCropFormData({...cropFormData, growthStage: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. Vegetative, Flowering"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Health (1-10)")}</label>
                  <input
                    type="number"
                    min="1" max="10"
                    value={cropFormData.healthScore}
                    onChange={e => setCropFormData({...cropFormData, healthScore: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Moisture (1-10)")}</label>
                  <input
                    type="number"
                    min="1" max="10"
                    value={cropFormData.moistureScore}
                    onChange={e => setCropFormData({...cropFormData, moistureScore: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Pest Risk (1-10)")}</label>
                  <input
                    type="number"
                    min="1" max="10"
                    value={cropFormData.pestRisk}
                    onChange={e => setCropFormData({...cropFormData, pestRisk: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Notes")}</label>
                <textarea
                  rows={3}
                  value={cropFormData.notes}
                  onChange={e => setCropFormData({...cropFormData, notes: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder={t("Any signs of disease, pests, or issues?")}
                />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
                <Button variant="ghost" type="button" onClick={() => {
                  setShowCropModal(false);
                  fetchTasks(); // refresh to show as completed
                }}>{t("Skip")}</Button>
                <Button type="submit">{t("Save Observation")}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
