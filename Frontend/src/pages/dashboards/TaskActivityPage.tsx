import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiUploadCloud, FiCheckCircle, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { motion, AnimatePresence } from 'framer-motion';

const ACTIVITY_TYPES = [
  'Soil Preparation',
  'Irrigation',
  'Fertilizer Application',
  'Pesticide Application',
  'Harvesting',
  'Weeding',
  'Planting',
  'Pruning',
  'Livestock Feeding',
  'Cleaning Farm',
  'Other'
];

export default function TaskActivityPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isFinal, setIsFinal] = useState(location.state?.isFinal || false);
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<string[]>([]);

  // Duplicate Warning Modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [duplicateImages, setDuplicateImages] = useState<any[]>([]);

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  const fetchTaskDetails = async () => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch(`/api/tasks/farmer`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const found = data.find((t: any) => t.id === taskId);
        setTask(found);
        if (found && found.completion_percentage) {
          setProgress(Number(found.completion_percentage));
        }
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      const newErrors: string[] = [];

      newFiles.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
          newErrors.push(`${file.name} is larger than 5MB.`);
        } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          newErrors.push(`${file.name} format is not allowed (only JPG, PNG, WEBP).`);
        } else {
          validFiles.push(file);
        }
      });

      if (images.length + validFiles.length > 5) {
        newErrors.push('You can upload a maximum of 5 images.');
      } else {
        setImages([...images, ...validFiles]);
      }

      if (newErrors.length > 0) setErrors(newErrors);
      else setErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent, forceSubmit = false) => {
    e.preventDefault();
    setErrors([]);
    const newErrors = [];
    if (notes.length < 20) newErrors.push('Description must be at least 20 characters.');
    if (images.length < 1) newErrors.push('At least 1 image is required.');
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const formData = new FormData();
      formData.append('notes', notes);
      formData.append('isFinal', isFinal.toString());
      if (forceSubmit) {
        formData.append('forceSubmit', 'true');
      }
      
      formData.append('progressPercentage', progress.toString());
      formData.append('activityType', task?.title || 'Task Update');
      
      images.forEach(img => formData.append('images', img));

      const endpoint = `/api/tasks/${taskId}/activity-update`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notifySuccess('Task evidence submitted successfully!');
        setShowDuplicateModal(false);
        navigate('/dashboard/farmer-worker/tasks');
      } else {
        const errData = await res.json();
        
        if (errData.duplicateWarning) {
          // Show duplicate warning modal
          setDuplicateMessage(errData.message || 'Duplicate images detected.');
          setDuplicateImages(errData.images || []);
          setShowDuplicateModal(true);
        } else {
          notifyError(errData.error || 'Failed to submit update');
        }
      }
    } catch (err) {
      console.error(err);
      notifyError('An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-white p-6">Loading task...</div>;
  if (!task) return <div className="text-white p-6">Task not found</div>;

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <SectionHeading 
        eyebrow="Task Activity" 
        title={task.title} 
        description="Update your task progress and provide evidence." 
        tone="light" 
      />

      {/* Progress Bar */}
      <Card>
        <div className="mb-2 flex justify-between text-sm text-slate-300">
          <span>Task Progress ({task.completion_percentage || 0}%)</span>
          <span className="text-emerald-400 font-bold">{task.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-500" 
            style={{ width: `${task.completion_percentage || 0}%` }}
          />
        </div>
      </Card>

      <Card title="Task Evidence Submission">
        <form onSubmit={e => handleSubmit(e, false)} className="space-y-6 mt-4">
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              <ul className="list-disc pl-5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Assigned Task</label>
              <input 
                type="text"
                readOnly
                value={task?.title || ''}
                className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2 text-white/70 cursor-not-allowed focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Total Progress Percentage (100 = completed)</label>
              <input 
                type="number" min="0" max="100" 
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description (Notes)</label>
            <textarea 
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe the work done in detail (Min 20 characters)"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">{notes.length} characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Evidence Images (2-5 for final, up to 5 for update)</label>
            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center bg-slate-900/50 hover:bg-slate-900 transition-colors relative">
              <input 
                type="file" 
                multiple 
                accept="image/jpeg, image/png, image/webp" 
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                id="image-upload" 
              />
              <div className="flex flex-col items-center pointer-events-none">
                <FiUploadCloud className="text-4xl text-emerald-500 mb-2" />
                <span className="text-white font-medium">Click or Drag to upload images</span>
                <span className="text-slate-400 text-sm mt-1">Max 5MB each (JPG, PNG, WEBP)</span>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10">
                    <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-24 object-cover" />
                    <button 
                      type="button"
                      onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-[10px] text-white px-1 py-0.5 text-center truncate pointer-events-none">
                      {(img.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>



          <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
            <Button variant="ghost" type="button" onClick={() => navigate('/dashboard/farmer-worker/tasks')}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : isFinal ? 'Submit Final Review' : 'Save Update'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Duplicate Warning Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 rounded-2xl border border-amber-500/50 shadow-2xl p-6 w-full max-w-2xl">
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <FiAlertTriangle className="text-3xl" />
                <h3 className="text-xl font-bold text-white">Duplicate Evidence Detected</h3>
              </div>
              <p className="text-sm text-slate-300 mb-6">{duplicateMessage}</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                 {duplicateImages.map((img: any, i: number) => (
                    <div key={i} className={`relative rounded-xl overflow-hidden border aspect-square ${img.status !== '✓' ? 'border-red-500' : 'border-emerald-500'}`}>
                       <img src={img.url} alt="Evidence" className="w-full h-full object-cover" />
                       <div className={`absolute top-0 right-0 left-0 text-[10px] text-white font-bold px-1 py-1 text-center truncate backdrop-blur-sm ${img.status !== '✓' ? 'bg-red-500/90' : 'bg-emerald-500/90'}`}>
                         {img.status}
                       </div>
                    </div>
                 ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="ghost" onClick={() => setShowDuplicateModal(false)} className="flex-1 border border-white/10">
                  Cancel & Change Images
                </Button>
                <Button onClick={(e: any) => handleSubmit(e, true)} disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                  {submitting ? 'Submitting...' : 'Proceed Anyway'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
