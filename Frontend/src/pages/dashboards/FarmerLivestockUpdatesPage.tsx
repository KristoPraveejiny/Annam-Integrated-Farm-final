// FarmerLivestockUpdatesPage.tsx – similar to FarmerCropUpdatesPage but for livestock tasks
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiUploadCloud, FiSearch } from 'react-icons/fi';

export default function FarmerLivestockUpdatesPage() {
  const [activeTab, setActiveTab] = useState('activities');
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  // Form state
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityNotes, setActivityNotes] = useState('');
  const [activityImage, setActivityImage] = useState<File | null>(null);

  // Fetch tasks assigned to the farmer (including livestock tasks)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        const res = await fetch('http://localhost:5000/api/tasks/farmer', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const active = data.filter((t: any) => t.status !== 'done' && t.crop_cycle_id == null);
          setTasks(active);
        }
      } catch (err) {
        console.error('Failed to fetch tasks', err);
      }
    };
    fetchTasks();
  }, []);

  // Filter tasks for the selected date (due_date stored in UTC)
  const tasksForDate = tasks.filter((t) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return local === activityDate;
  });

  // Keep a selected task if available
  useEffect(() => {
    if (tasksForDate.length > 0 && !tasksForDate.find((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(tasksForDate[0].id);
    } else if (tasksForDate.length === 0) {
      setSelectedTaskId('');
    }
  }, [tasksForDate, selectedTaskId]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return alert('No task selected');
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
    const formData = new FormData();
    formData.append('notes', activityNotes);
    if (activityImage) formData.append('image', activityImage);
    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${selectedTaskId}/updates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        alert('Livestock activity updated!');
        setActivityNotes('');
        setActivityImage(null);
      } else {
        alert('Failed to update activity');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating activity');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading eyebrow="Livestock Updates" title="Livestock Management" description="Record daily livestock tasks, feedings, and health notes." tone="light" />

      {/* Tabs – for now we only need the activities tab */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['activities'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]' : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'
            }`}
          >
            {tab === 'activities' ? 'Daily Activities' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'activities' && (
        <Card title="Record Livestock Activity" subtitle="Log feeding, health checks, and other field work">
          <form className="space-y-6 mt-4" onSubmit={handleActivitySubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">Activity Type (Today's Tasks)</span>
                <select
                  className="farm-input w-full appearance-none"
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                >
                  {tasksForDate.length === 0 ? (
                    <option value="">No livestock tasks for selected date</option>
                  ) : (
                    tasksForDate.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">Livestock / Pen</span>
                <input
                  type="text"
                  readOnly
                  value={selectedTask?.livestock_name || selectedTask?.livestock_tag || selectedTask?.pen || 'N/A'}
                  className="farm-input w-full bg-white/5 cursor-not-allowed text-white/50"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Date</span>
              <input type="date" className="farm-input w-full" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Manager's Instructions</span>
              <textarea
                className="farm-input w-full min-h-24 bg-white/5 cursor-not-allowed text-white/50"
                placeholder="Details from manager..."
                readOnly
                value={selectedTask?.description || 'No instructions provided.'}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Farmer's Notes</span>
              <textarea
                className="farm-input w-full min-h-24"
                placeholder="Describe what you actually did..."
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Upload Image of Work</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && setActivityImage(e.target.files[0])}
                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-500 hover:file:bg-emerald-500/20 transition-all cursor-pointer"
              />
            </label>

            <Button type="submit" className="w-full sm:w-auto" disabled={!selectedTaskId}>Save Activity</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
