import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiPlus, FiAlertTriangle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';

export default function FarmManagerTasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [livestockGroups, setLivestockGroups] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cropCycleId: '',
    livestockGroupId: '',
    assignedToUserId: '',
    priority: 'medium',
    session: 'morning',
    dueDate: ''
  });

  const todayDate = new Date().toISOString().split('T')[0];

  const normalizeTaskStatus = (status: string | undefined | null) =>
    String(status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  const getDisplayStatus = (task: any) => {
    const status = normalizeTaskStatus(task.status);
    if ((status === 'completed' || status === 'done' || status === 'approved' || status === 'waiting_for_manager_approval' || status === 'waiting_manager_approval') && task.completion_percentage < 100) {
      return 'in_progress';
    }
    return status;
  };

  const fetchData = async () => {
    try {
      const [tasksRes, cropsRes, workersRes, livestockRes, shiftsRes] = await Promise.all([
        apiFetch('/api/tasks/manager'),
        apiFetch('/api/crops'),
        apiFetch('/api/tasks/workers'),
        apiFetch('/api/livestock/groups'),
        apiFetch('/api/shifts')
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }
      
      if (cropsRes.ok) {
        const cropsData = await cropsRes.json();
        setCrops(cropsData);
      }

      if (workersRes.ok) {
        const workersData = await workersRes.json();
        setFarmers(workersData);
      }
      
      if (livestockRes.ok) {
        const livestockData = await livestockRes.json();
        setLivestockGroups(livestockData);
      }

      if (shiftsRes.ok) {
        const shiftsData = await shiftsRes.json();
        setShifts(shiftsData);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.dueDate && formData.dueDate < todayDate) {
      notifyWarning('Task date cannot be earlier than today.');
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
          ...formData,
          shiftId: selectedShift?.id,
          session: String(selectedShift?.shift_name || formData.session).trim().toLowerCase()
        })
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ title: '', description: '', cropCycleId: '', livestockGroupId: '', assignedToUserId: '', priority: 'medium', session: 'morning', dueDate: '' });
        fetchData();
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

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t("Task Management")}
        title={t("Farm Tasks")}
        description={t("Assign tasks to farmers and track completion")}
        tone="light"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <h4 className="text-emerald-400 text-sm font-bold uppercase tracking-wider">Today's Activities</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => new Date(t.updated_at).toDateString() === new Date().toDateString()).length}</p>
        </Card>
        <Card className="bg-violet-500/10 border-violet-500/20">
          <h4 className="text-violet-400 text-sm font-bold uppercase tracking-wider">Pending Reviews</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => getDisplayStatus(t) === 'waiting_manager_approval').length}</p>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <h4 className="text-blue-400 text-sm font-bold uppercase tracking-wider">Tasks Completed Today</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => getDisplayStatus(t) === 'completed' && new Date(t.completed_at).toDateString() === new Date().toDateString()).length}</p>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <h4 className="text-amber-400 text-sm font-bold uppercase tracking-wider">Workers Active</h4>
          <p className="text-3xl font-black text-white mt-2">{new Set(tasks.filter(t => getDisplayStatus(t) === 'in_progress').map(t => t.assigned_to_user_id)).size}</p>
        </Card>
      </div>

      <Card title={t("Task List")} subtitle={t("All tasks created for your farm")}>
        <div className="flex justify-end mb-6">
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 whitespace-nowrap">
            <FiPlus className="text-lg" /> {t("Assign Task")}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">{t("Task Name")}</th>
                <th className="px-6 py-4">{t("Assigned To")}</th>
                <th className="px-6 py-4">{t("Related Entity")}</th>
                <th className="px-6 py-4">{t("Priority")}</th>
                <th className="px-6 py-4">{t("Session")}</th>
                <th className="px-6 py-4">{t("Due Date")}</th>
                <th className="px-6 py-4">{t("Status")}</th>
                <th className="px-6 py-4 text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/60">
               {loading ? (
                 <tr><td colSpan={8} className="px-6 py-4 text-center text-slate-500">Loading tasks...</td></tr>
               ) : tasks.length === 0 ? (
                 <tr><td colSpan={8} className="px-6 py-4 text-center text-slate-500">{t("No tasks found")}</td></tr>
               ) : (
                tasks.map(task => (
                  <tr key={task.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white relative">
                      <div className="flex items-center gap-2">
                        {task.title}
                        {task.needs_manager_review && (
                          <FiAlertTriangle className="text-amber-500" title="Needs Manager Review" />
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${task.completion_percentage || 0}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{task.completion_percentage || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{task.assigned_to_name || 'Unassigned'}</td>
                    <td className="px-6 py-4">{task.crop_name || task.livestock_name || 'N/A'}</td>
                    <td className="px-6 py-4 capitalize">{task.priority}</td>
                    <td className="px-6 py-4 capitalize">{task.session || 'morning'}</td>
                    <td className="px-6 py-4">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        getDisplayStatus(task) === 'completed' || getDisplayStatus(task) === 'approved' || getDisplayStatus(task) === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        getDisplayStatus(task) === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        getDisplayStatus(task) === 'waiting_manager_approval' || getDisplayStatus(task) === 'waiting_for_manager_approval' ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{String(getDisplayStatus(task)).replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {getDisplayStatus(task) === 'waiting_manager_approval' || getDisplayStatus(task) === 'waiting_for_manager_approval' || getDisplayStatus(task) === 'completed' || task.total_updates > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate(`/dashboard/farm-manager/tasks/${task.id}/review`)}
                          className="!px-3 !py-2 text-slate-200 hover:text-white"
                        >
                          {t("Review Activity")}
                        </Button>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-white mb-6">{t("Assign New Task")}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Task Title")}</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder={t("eg Inspect irrigation lines")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Description")}</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder={t("Details about the task")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Assign to Farmer")}</label>
                <select
                  required
                  value={formData.assignedToUserId}
                  onChange={e => setFormData({...formData, assignedToUserId: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="" disabled>{t("Select farmer")}</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Related Crop")}</label>
                  <select
                    value={formData.cropCycleId}
                    onChange={e => setFormData({...formData, cropCycleId: e.target.value, livestockGroupId: ''})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    disabled={!!formData.livestockGroupId}
                  >
                    <option value="">{t("None")}</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>{c.crop_name} {c.variety ? `(${c.variety})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Related Livestock")}</label>
                  <select
                    value={formData.livestockGroupId}
                    onChange={e => setFormData({...formData, livestockGroupId: e.target.value, cropCycleId: ''})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    disabled={!!formData.cropCycleId}
                  >
                    <option value="">{t("None")}</option>
                    {livestockGroups.map(lg => (
                      <option key={lg.id} value={lg.id}>{lg.group_code} - {lg.species}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value})}
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
                    onChange={e => setFormData({...formData, session: e.target.value})}
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
                  <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    min={todayDate}
                    value={formData.dueDate}
                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
                <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>{t("Cancel")}</Button>
                <Button type="submit">{t("Create Task")}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
