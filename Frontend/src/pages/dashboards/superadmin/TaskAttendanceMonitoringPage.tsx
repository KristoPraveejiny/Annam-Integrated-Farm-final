import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminTasks } from '../../../api/admin';

interface Task {
  id: string;
  assigned_to_name: string;
  created_by_name: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  progress_percent: number;
  due_date: string;
  created_at: string;
  field_name?: string | null;
  field_code?: string | null;
  crop_name?: string | null;
  livestock_species?: string | null;
  livestock_group_code?: string | null;
}

const normalizeStatus = (status?: string | null) =>
  String(status || '').trim().toLowerCase().replace(/_/g, ' ');

const statusClass = (status?: string | null) => {
  const value = normalizeStatus(status);
  if (['approved', 'done', 'completed'].includes(value)) return 'bg-emerald-500/15 text-emerald-300';
  if (value === 'in progress') return 'bg-sky-500/15 text-sky-300';
  if (value.startsWith('waiting')) return 'bg-violet-500/15 text-violet-300';
  if (['missed shift', 'rejected'].includes(value)) return 'bg-rose-500/15 text-rose-300';
  return 'bg-white/10 text-slate-300';
};

// Every farm carries the same auto-generated "My Default Farm" name, so the field the
// task actually belongs to is what identifies it. Crop tasks resolve through their crop
// cycle; livestock tasks name their group instead.
const taskLocation = (task: Task) => {
  if (task.field_name) {
    return {
      primary: task.field_name,
      secondary: [task.field_code, task.crop_name].filter(Boolean).join(' · '),
    };
  }
  if (task.livestock_species) {
    return {
      primary: task.livestock_species,
      secondary: task.livestock_group_code || '',
    };
  }
  return { primary: 'Unassigned', secondary: '' };
};

export default function TaskAttendanceMonitoringPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await getAdminTasks();
      setTasks(data);
    } catch (err) {
      setError('Failed to load tasks data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Task & Attendance Monitoring")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">Loading tasks...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : tasks.length === 0 ? (
          <p className="p-4 text-slate-300">No tasks found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Field</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Progress & Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {tasks.map((task) => {
                  const location = taskLocation(task);

                  return (
                  <tr key={task.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{task.title}</div>
                      <div className="text-xs text-slate-300 capitalize">{task.category || 'General'} | {task.priority} Priority</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {task.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{location.primary}</div>
                      {location.secondary && (
                        <div className="text-xs text-slate-300">{location.secondary}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${statusClass(task.status)}`}>
                          {normalizeStatus(task.status) || 'unknown'}
                        </span>
                        <span className="text-xs text-slate-300">{Number(task.progress_percent || 0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
