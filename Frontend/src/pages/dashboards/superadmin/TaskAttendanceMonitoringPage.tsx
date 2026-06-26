import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminTasks } from '../../../api/admin';

interface Task {
  id: string;
  farm_name: string;
  assigned_to_name: string;
  created_by_name: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  progress_percent: number;
  due_date: string;
  created_at: string;
}

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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Progress & Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{task.title}</div>
                      <div className="text-xs text-slate-300 capitalize">{task.category || 'General'} | {task.priority} Priority</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {task.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {task.farm_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                          task.status === 'done' ? 'bg-emerald-500/15 text-emerald-300' :
                          task.status === 'in_progress' ? 'bg-sky-500/15 text-sky-300' :
                          'bg-white/10 text-slate-300'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-300">{task.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
