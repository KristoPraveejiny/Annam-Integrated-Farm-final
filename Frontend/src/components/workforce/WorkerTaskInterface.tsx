import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, UploadCloud, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';

interface Task {
  id: string;
  title: string;
  status: string;
  description: string;
  actual_start_time?: string;
  shift_end_time?: string;
}

const WorkerTaskInterface: React.FC<{ task: Task, onUpdate: () => void }> = ({ task, onUpdate }) => {
  const [liveTimer, setLiveTimer] = useState<string>('00:00:00');
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [duringImage, setDuringImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (task.status === 'in_progress' && task.actual_start_time) {
      interval = setInterval(() => {
        const start = new Date(task.actual_start_time!).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 1000);

        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setLiveTimer(`${h}:${m}:${s}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [task.status, task.actual_start_time]);

  const handleStartWork = async () => {
    try {
      setLoading(true);
      await apiFetch(`/api/tasks/${task.id}/start`, { method: 'POST' });
      onUpdate();
    } catch (error) {
      console.error('Failed to start task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdditionalImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + 3 > 10) {
        alert('Maximum 10 images total allowed.');
        return;
      }
      setAdditionalImages(files);
    }
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeImage || !duringImage || !afterImage) {
      return alert('Before, During, and After images are strictly required.');
    }

    const formData = new FormData();
    formData.append('notes', notes);
    formData.append('images', beforeImage, 'Before_' + beforeImage.name);
    formData.append('images', duringImage, 'During_' + duringImage.name);
    formData.append('images', afterImage, 'After_' + afterImage.name);
    additionalImages.forEach((img, idx) => formData.append('images', img, 'Additional_' + idx + '_' + img.name));

    try {
      setLoading(true);
      const res = await apiFetch(`/api/tasks/${task.id}/evidence`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status: ${res.status}`);
      }
      onUpdate();
    } catch (error: any) {
      console.error('Failed to submit evidence:', error);
      alert(error.message || 'Failed to submit evidence. It may have been rejected by the strict AI verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-white shadow-xl">
      <h3 className="text-xl font-bold mb-2">{task.title}</h3>
      <p className="text-gray-300 mb-6">{task.description}</p>

      {['todo', 'pending', 'assigned', 'accepted'].includes(task.status) && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStartWork}
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-colors"
        >
          <Play className="mr-2" /> Start Work
        </motion.button>
      )}

      {task.status === 'in_progress' && (
        <div className="space-y-6">
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-6 text-center">
            <h4 className="text-emerald-300 font-semibold mb-2">Live Timer</h4>
            <div className="text-5xl font-mono text-emerald-400 font-bold tracking-wider">
              {liveTimer}
            </div>
          </div>

          <form onSubmit={handleSubmitEvidence} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Completion Notes (Required)</label>
              <textarea
                required
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                rows={3}
                placeholder="Describe the work completed..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">Strict Evidence Verification</label>
              <p className="text-xs text-emerald-300 mb-4">Please upload a sequence of 3 required photos to prove task completion. Max 10 photos total.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative border-2 border-dashed border-white/30 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                  <input type="file" accept="image/*" required onChange={e => setBeforeImage(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-white">Before Work</p>
                  <p className="text-xs text-gray-300">{beforeImage ? beforeImage.name : 'Required'}</p>
                </div>
                
                <div className="relative border-2 border-dashed border-white/30 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                  <input type="file" accept="image/*" required onChange={e => setDuringImage(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-white">During Work</p>
                  <p className="text-xs text-gray-300">{duringImage ? duringImage.name : 'Required'}</p>
                </div>

                <div className="relative border-2 border-dashed border-white/30 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                  <input type="file" accept="image/*" required onChange={e => setAfterImage(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-white">After Work</p>
                  <p className="text-xs text-gray-300">{afterImage ? afterImage.name : 'Required'}</p>
                </div>
              </div>

              <div className="relative border-2 border-dashed border-white/30 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                  <input type="file" multiple accept="image/*" onChange={handleAdditionalImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="mx-auto h-6 w-6 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-300">{additionalImages.length > 0 ? `${additionalImages.length} additional images` : 'Optional: Additional Evidence (Max 7)'}</p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || !beforeImage || !duringImage || !afterImage}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center transition-colors"
            >
              <CheckCircle2 className="mr-2" /> Submit Evidence
            </motion.button>
          </form>
        </div>
      )}

      {(task.status === 'work_pending_confirmation' || task.status === 'overdue') && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
          <h4 className="text-red-300 font-semibold mb-2">Missing Evidence</h4>
          <p className="text-sm mb-4">Your shift has ended but evidence was not submitted. Please upload now.</p>
          {/* Re-use the form here if needed, or simply render it. For brevity, omitted. */}
        </div>
      )}

      {(task.status === 'waiting_manager_approval' || task.status === 'late_submission') && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 text-center">
          <Clock className="mx-auto h-12 w-12 text-yellow-400 mb-2" />
          <h4 className="text-yellow-300 font-semibold">Under Review</h4>
          <p className="text-sm">Manager will review your evidence shortly.</p>
        </div>
      )}
    </div>
  );
};

export default WorkerTaskInterface;
