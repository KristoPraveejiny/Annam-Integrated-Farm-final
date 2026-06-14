import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiUploadCloud, FiSearch, FiLayers, FiDroplet } from 'react-icons/fi';

const activitiesFallback = ['Irrigation', 'Fertilizer Application', 'Pesticide Application', 'Weeding', 'Pruning', 'Harvesting'];
const stages = ['Seed Sowing', 'Germination', 'Vegetative', 'Flowering', 'Fruiting', 'Harvesting'];

export default function FarmerCropUpdatesPage() {
  const [activeTab, setActiveTab] = useState('activities');
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  
  // Activity form states
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityNotes, setActivityNotes] = useState('');
  const [activityImage, setActivityImage] = useState<File | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        const res = await fetch('http://localhost:5000/api/tasks/farmer', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const activeTasks = data.filter((t: any) => t.status !== 'done' && t.crop_cycle_id != null);
          setTasks(activeTasks);
        }
      } catch (err) {
        console.error('Failed to fetch tasks', err);
      }
    };
    fetchTasks();
  }, []);

  const tasksForDate = tasks.filter(t => {
    if (!t.due_date) return false;
    // Convert UTC due_date to local browser timezone YYYY-MM-DD
    const d = new Date(t.due_date);
    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return localDateStr === activityDate;
  });

  useEffect(() => {
    if (tasksForDate.length > 0 && !tasksForDate.find(t => t.id === selectedTaskId)) {
      setSelectedTaskId(tasksForDate[0].id);
    } else if (tasksForDate.length === 0) {
      setSelectedTaskId('');
    }
  }, [tasksForDate, selectedTaskId]);

  // Derive unique crops from tasks for the first tab
  const uniqueCrops = Array.from(new Set(tasks.filter(t => t.crop_name).map(t => t.crop_name)));
  const cropsOptions = uniqueCrops.length > 0 ? uniqueCrops : ['No active crops found'];

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return alert('No task selected');

    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

    const formData = new FormData();
    formData.append('notes', activityNotes);
    if (activityImage) {
      formData.append('image', activityImage);
    }

    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${selectedTaskId}/updates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        alert('Activity updated successfully!');
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
      <SectionHeading eyebrow="Crop Updates" title="Crop Management" description="Update crop stages, record daily activities, and report diseases." tone="light" />

      {/* Tabs */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['stages', 'activities', 'disease'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]' : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'}`}
          >
            {tab === 'disease' ? 'Disease Reporting' : tab === 'stages' ? 'Crop Stages' : 'Daily Activities'}
          </button>
        ))}
      </div>

      {activeTab === 'stages' && (
        <Card title="Update Crop Stage" subtitle="Select crop and update current growth stage">
          <form className="space-y-6 mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">Select Crop</span>
                <select className="farm-input w-full appearance-none">
                  {cropsOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">Current Stage</span>
                <select className="farm-input w-full appearance-none">
                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Add Notes</span>
              <textarea className="farm-input w-full min-h-32" placeholder="Describe the growth condition..." />
            </label>

            <div>
              <span className="mb-2 block text-sm font-semibold text-white/80">Upload Images</span>
              <div className="grid place-items-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-8 text-center hover:bg-white/10 transition-colors cursor-pointer">
                <FiUploadCloud className="text-4xl text-emerald-400" />
                <p className="mt-4 text-sm text-slate-300">Drag and drop images here</p>
              </div>
            </div>

            <Button type="button" className="w-full sm:w-auto">Update Progress</Button>
          </form>
        </Card>
      )}

      {activeTab === 'activities' && (
        <Card title="Record Daily Activity" subtitle="Log irrigation, fertilizing, and other field tasks">
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
                    <option value="">No tasks assigned for selected date</option>
                  ) : (
                    tasksForDate.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">Crop / Field</span>
                <input 
                  type="text" 
                  readOnly 
                  value={selectedTask?.crop_name || 'N/A'}
                  className="farm-input w-full bg-white/5 cursor-not-allowed text-white/50" 
                  placeholder="Crop will auto-fill from task"
                />
              </label>
            </div>
            
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Date</span>
              <input 
                type="date" 
                className="farm-input w-full" 
                value={activityDate}
                onChange={e => setActivityDate(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Manager's Instructions</span>
              <textarea 
                className="farm-input w-full min-h-24 bg-white/5 cursor-not-allowed text-white/50" 
                placeholder="Details from manager..." 
                readOnly
                value={selectedTask?.description || 'No specific instructions provided.'}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Farmer's Notes</span>
              <textarea 
                className="farm-input w-full min-h-24" 
                placeholder="Describe what you actually did..." 
                value={activityNotes}
                onChange={e => setActivityNotes(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">Upload Image of Work</span>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => e.target.files && setActivityImage(e.target.files[0])}
                className="block w-full text-sm text-slate-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-emerald-500/10 file:text-emerald-500
                  hover:file:bg-emerald-500/20 transition-all cursor-pointer"
              />
            </label>

            <Button type="submit" className="w-full sm:w-auto" disabled={!selectedTaskId}>Save Activity</Button>
          </form>
        </Card>
      )}

      {activeTab === 'disease' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Report Disease" subtitle="Upload leaf images for AI analysis">
            <div className="grid place-items-center rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 p-10 text-center cursor-pointer hover:bg-emerald-500/20 transition-colors">
              <FiUploadCloud className="text-6xl text-emerald-500" />
              <p className="mt-4 text-lg font-bold text-white">Upload leaf photo</p>
              <p className="mt-2 text-sm text-slate-400">Supported formats: JPG, PNG</p>
              <Button className="mt-6">Choose File</Button>
            </div>
          </Card>
          <Card title="Detection Results" subtitle="AI feedback and recommendations">
            <div className="h-full flex flex-col justify-center items-center text-slate-400 p-6 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
              <FiSearch className="text-4xl mb-3 text-slate-500"/>
              <p>Upload an image to see disease confidence scores and suggested treatments.</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
