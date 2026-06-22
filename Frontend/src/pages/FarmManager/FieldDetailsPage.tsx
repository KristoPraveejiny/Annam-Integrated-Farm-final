import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { Button } from '../../components/ui/Button';
import { FiArrowLeft, FiMapPin, FiDroplet, FiLayers, FiActivity, FiCheckCircle, FiClock, FiAlertCircle, FiLink } from 'react-icons/fi';

export default function FieldDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [allCrops, setAllCrops] = useState<any[]>([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState('');

  const getToken = () => {
    const t = localStorage.getItem('token');
    return t && t.startsWith('"') ? t.slice(1, -1) : t;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${getToken()}` };
      const [fieldRes, cropsRes] = await Promise.all([
        fetch(`/api/fields/${id}`, { headers }),
        fetch('/api/crops', { headers })
      ]);
      if (!fieldRes.ok) throw new Error('Failed to fetch field details');
      setData(await fieldRes.json());
      if (cropsRes.ok) setAllCrops(await cropsRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAssignCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCropId) return;
    setIsAssigning(true);
    try {
      const res = await fetch(`/api/fields/${id}/assign-crop`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop_cycle_id: selectedCropId })
      });
      if (!res.ok) throw new Error('Failed to assign crop');
      setSelectedCropId('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-lg">Loading field details...</div>
    </div>
  );

  if (error || !data?.field) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
        <FiArrowLeft /> Back
      </Button>
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl">{error || 'Field not found'}</div>
    </div>
  );

  const { field, current_crop, history, tasks } = data;

  const taskIcon = (status: string) => {
    if (status === 'done') return <FiCheckCircle className="text-emerald-400" />;
    if (status === 'in_progress') return <FiClock className="text-blue-400" />;
    if (status === 'blocked') return <FiAlertCircle className="text-red-400" />;
    return <FiClock className="text-amber-400" />;
  };

  const taskBadge = (status: string) => {
    if (status === 'done') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (status === 'in_progress') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (status === 'blocked') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  };

  const cropStatusBadge = (status: string) => {
    if (status === 'growing') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (status === 'planned') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (status === 'harvesting') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (status === 'harvested') return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  // Unlinked crops (no field_id or different field_id)
  const unlinkedCrops = allCrops.filter(c => !c.field_id || c.field_id !== id);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
          <FiArrowLeft />
        </button>
        <SectionHeading
          eyebrow="Field Details"
          title={field.field_name}
          description={field.field_code ? `Field Code: ${field.field_code}` : 'Farm field information and crop tracking'}
          tone="light"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Field Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-base mb-4 pb-2 border-b border-white/10">Field Information</h3>
            <div className="space-y-3">
              {[
                { icon: <FiActivity className="text-emerald-400" />, label: 'Area', value: field.area ? `${field.area} Acres` : 'N/A' },
                { icon: <FiLayers className="text-blue-400" />, label: 'Soil Type', value: field.soil_type || 'N/A' },
                { icon: <FiDroplet className="text-cyan-400" />, label: 'Irrigation', value: field.irrigation_type || 'N/A' },
                { icon: <FiMapPin className="text-amber-400" />, label: 'Location', value: field.location || 'N/A' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="mt-0.5">{item.icon}</span>
                  <div>
                    <div className="text-slate-500 text-xs">{item.label}</div>
                    <div className="text-slate-200 text-sm">{item.value}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-slate-500 text-xs">Status</span>
                <span className={`px-2 py-1 text-xs font-bold rounded-full border ${field.status?.toLowerCase() === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                  {field.status || 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Crop History */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-base mb-4 pb-2 border-b border-white/10">Crop History</h3>
            {history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((h: any) => (
                  <div key={h.id} className="bg-slate-950/60 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-sm font-medium">{h.crop_name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${cropStatusBadge(h.status)}`}>{h.status}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      {h.planting_date ? new Date(h.planting_date).toLocaleDateString() : 'N/A'}
                      {h.actual_harvest_date ? ` → ${new Date(h.actual_harvest_date).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-sm italic">No previous crop history.</p>
            )}
          </div>
        </div>

        {/* Right: Current Crop + Tasks */}
        <div className="lg:col-span-2 space-y-5">
          {/* Current Crop */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
              <h3 className="text-white font-semibold text-base">Current Crop Cycle</h3>
            </div>

            {current_crop ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Crop', value: current_crop.crop_name },
                  { label: 'Variety', value: current_crop.variety || 'N/A' },
                  { label: 'Season', value: current_crop.season || 'N/A' },
                  { label: 'Planting Date', value: current_crop.planting_date ? new Date(current_crop.planting_date).toLocaleDateString() : 'N/A' },
                  { label: 'Harvest Date', value: current_crop.expected_harvest_date ? new Date(current_crop.expected_harvest_date).toLocaleDateString() : 'N/A' },
                  { label: 'Growth Stage', value: current_crop.current_stage || 'Unknown' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-950/50 rounded-xl p-3">
                    <div className="text-slate-500 text-xs mb-1">{item.label}</div>
                    <div className="text-white font-medium text-sm">{item.value}</div>
                  </div>
                ))}
                <div className="col-span-2 md:col-span-3 flex items-center gap-2">
                  <span className="text-slate-500 text-xs">Status:</span>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${cropStatusBadge(current_crop.status)}`}>
                    {current_crop.status}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-slate-500 italic text-sm mb-4">No active crop cycle assigned to this field.</p>
                {unlinkedCrops.length > 0 && (
                  <form onSubmit={handleAssignCrop} className="flex items-center gap-3 bg-slate-950/60 rounded-xl p-3">
                    <FiLink className="text-emerald-400 shrink-0" />
                    <select
                      value={selectedCropId}
                      onChange={e => setSelectedCropId(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Assign existing crop cycle...</option>
                      {unlinkedCrops.map(c => (
                        <option key={c.id} value={c.id}>{c.crop_name}{c.variety ? ` (${c.variety})` : ''} — {c.status}</option>
                      ))}
                    </select>
                    <Button type="submit" disabled={!selectedCropId || isAssigning}>
                      {isAssigning ? 'Assigning...' : 'Assign'}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-base mb-4 pb-2 border-b border-white/10">
              Field Tasks <span className="text-slate-500 font-normal text-sm ml-2">({tasks?.length || 0} tasks)</span>
            </h3>

            {tasks && tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task: any) => (
                  <div key={task.id} className="bg-slate-950/60 border border-white/5 rounded-xl p-4 flex items-start gap-3">
                    <div className="mt-0.5">{taskIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-white font-medium text-sm">{task.title}</span>
                        <span className={`shrink-0 px-2 py-0.5 text-xs font-bold rounded-full border ${taskBadge(task.status)}`}>
                          {task.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span>Worker: <span className="text-slate-300">{task.assigned_worker_name || 'Unassigned'}</span></span>
                        <span>Priority: <span className="text-slate-300 capitalize">{task.priority}</span></span>
                        {task.due_date && <span>Due: <span className="text-slate-300">{new Date(task.due_date).toLocaleDateString()}</span></span>}
                      </div>
                      {task.description && <p className="text-slate-600 text-xs mt-1 truncate">{task.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-sm italic">No tasks associated with this field yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
