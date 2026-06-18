import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiPlus, FiCheckCircle } from 'react-icons/fi';

export default function FarmManagerTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [livestockGroups, setLivestockGroups] = useState<any[]>([]);
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

  const fetchData = async () => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const headers = { Authorization: `Bearer ${token}` };

      const [tasksRes, cropsRes, workersRes, livestockRes] = await Promise.all([
        fetch('/api/tasks/manager', { headers }),
        fetch('/api/crops', { headers }),
        fetch('/api/tasks/workers', { headers }),
        fetch('/api/livestock/groups', { headers })
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
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ title: '', description: '', cropCycleId: '', livestockGroupId: '', assignedToUserId: '', priority: 'medium', session: 'morning', dueDate: '' });
        fetchData();
        alert('Task assigned and email sent successfully!');
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to create task');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('An error occurred while saving.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow="Task Management"
        title="Farm Tasks"
        description="Assign tasks to farmers and track completion."
        tone="light"
      />

      <Card title="Task List" subtitle="All tasks created for your farm">
        <div className="flex justify-end mb-6">
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 whitespace-nowrap">
            <FiPlus className="text-lg" /> Assign Task
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">Task Name</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Related Entity</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Session</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/60">
               {loading ? (
                 <tr><td colSpan={6} className="px-6 py-4 text-center text-slate-500">Loading tasks...</td></tr>
               ) : tasks.length === 0 ? (
                 <tr><td colSpan={6} className="px-6 py-4 text-center text-slate-500">No tasks found. Click 'Assign Task' to create one.</td></tr>
               ) : (
                tasks.map(t => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{t.title}</td>
                    <td className="px-6 py-4">{t.assigned_to_name || 'Unassigned'}</td>
                    <td className="px-6 py-4">{t.crop_name || t.livestock_name || 'N/A'}</td>
                    <td className="px-6 py-4 capitalize">{t.priority}</td>
                    <td className="px-6 py-4 capitalize">{t.session || 'morning'}</td>
                    <td className="px-6 py-4">{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        t.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        t.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{t.status.replace('_', ' ')}</span>
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
            <h3 className="text-2xl font-bold text-white mb-6">Assign New Task</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. Inspect irrigation lines"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Details about the task..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Assign to Farmer *</label>
                <select
                  required
                  value={formData.assignedToUserId}
                  onChange={e => setFormData({...formData, assignedToUserId: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="" disabled>Select farmer...</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Related Crop (Optional)</label>
                  <select
                    value={formData.cropCycleId}
                    onChange={e => setFormData({...formData, cropCycleId: e.target.value, livestockGroupId: ''})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    disabled={!!formData.livestockGroupId}
                  >
                    <option value="">None</option>
                    {crops.map(c => (
                      <option key={c.id} value={c.id}>{c.crop_name} {c.variety ? `(${c.variety})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Related Livestock (Optional)</label>
                  <select
                    value={formData.livestockGroupId}
                    onChange={e => setFormData({...formData, livestockGroupId: e.target.value, cropCycleId: ''})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    disabled={!!formData.cropCycleId}
                  >
                    <option value="">None</option>
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
                    <option value="morning">Morning (Rs. 2000)</option>
                    <option value="afternoon">Afternoon (Rs. 2000)</option>
                    <option value="evening">Evening (Rs. 1000)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
                <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit">Create Task</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
