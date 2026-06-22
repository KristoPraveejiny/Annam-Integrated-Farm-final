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
      <h1 className="text-2xl font-bold text-gray-900">{t("Task & Attendance Monitoring")}</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading tasks...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : tasks.length === 0 ? (
          <p className="text-gray-500 p-4">No tasks found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress & Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{task.title}</div>
                      <div className="text-xs text-gray-500 capitalize">{task.category || 'General'} | {task.priority} Priority</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.farm_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                          task.status === 'done' ? 'bg-green-100 text-green-800' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{task.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
