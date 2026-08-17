import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiPlus, FiAlertTriangle, FiFileText } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';

export default function FarmManagerTasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [livestockGroups, setLivestockGroups] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterWorker, setFilterWorker] = useState('');
  const [filterTask, setFilterTask] = useState('');
  const [filterCrop, setFilterCrop] = useState('All');
  const [filterRisk, setFilterRisk] = useState('All');
  const [filterVerification, setFilterVerification] = useState('All');
  const [filterReview, setFilterReview] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');


  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cropCycleId: '',
    livestockGroupId: '',
    assignedToUserId: '',
    priority: 'medium',
    session: 'morning',
    dueDate: '',
    attachmentUrl: '',
    attachmentName: ''
  });

  const todayDate = new Date().toISOString().split('T')[0];

  const normalizeTaskStatus = (status: string | undefined | null) =>
    String(status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  const getDisplayStatus = (task: any) => {
    const status = normalizeTaskStatus(task.status);
    if (status === 'approved' && (task.completion_percentage || 0) < 100) {
      return 'in_progress';
    }
    return status;
  };

  const parseEvidenceDetails = (task: any) => {
    const details = task.latest_update?.verification_score_details || {};
    return typeof details === 'string' ? JSON.parse(details || '{}') : details;
  };

  const getEvidenceScore = (task: any) => {
    const aiConfidence = task.latest_update?.ai_confidence || 0;
    const score = Number(task.verification_score || task.latest_update?.verification_score_details?.score || aiConfidence);
    return Number.isFinite(score) ? score : 0;
  };

  const getRiskLevel = (task: any) => {
    const score = getEvidenceScore(task);
    return score >= 90 ? 'Low Risk' : score >= 70 ? 'Medium Risk' : 'High Risk';
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

  useEffect(() => {
    if (location.state && location.state.isNewTask && crops.length > 0) {
      setFormData(prev => ({
        ...prev,
        title: location.state.prefillTitle || '',
        description: location.state.prefillDescription || '',
        category: location.state.prefillCategory || 'Planting & Maintenance',
        attachmentUrl: location.state.prefillAttachmentUrl || '',
        attachmentName: location.state.prefillAttachmentName || ''
      }));
      setShowModal(true);
      
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, crops]);

  
  const filteredTasks = tasks.filter(task => {
    const risk = getRiskLevel(task);
    const score = getEvidenceScore(task);
    const workerName = String(task.assigned_to_name || '').toLowerCase();
    const taskName = String(task.title || '').toLowerCase();
    const crop = String(task.crop_name || task.livestock_name || 'N/A');
    const status = getDisplayStatus(task);
    const submitted = task.latest_update?.created_at;

    if (filterWorker && !workerName.includes(filterWorker.toLowerCase())) return false;
    if (filterTask && !taskName.includes(filterTask.toLowerCase())) return false;
    if (filterCrop !== 'All' && crop !== filterCrop) return false;
    
    if (filterRisk !== 'All') {
      if (filterRisk === 'High' && risk !== 'High Risk') return false;
      if (filterRisk === 'Medium' && risk !== 'Medium Risk') return false;
      if (filterRisk === 'Low' && risk !== 'Low Risk') return false;
    }

    if (filterVerification !== 'All') {
      if (filterVerification === 'Verified' && score < 90) return false;
      if (filterVerification === 'Warning' && (score < 50 || score >= 90)) return false;
      if (filterVerification === 'High Risk' && score >= 50) return false;
      if (filterVerification === 'Rejected' && score !== 0) return false; // assuming 0 is rejected score
    }

    if (filterReview !== 'All') {
      if (filterReview === 'Pending' && status !== 'waiting_manager_approval') return false;
      if (filterReview === 'Approved' && status !== 'approved' && status !== 'completed') return false;
      if (filterReview === 'Rejected' && status !== 'rejected') return false;
      if (filterReview === 'Rework Requested' && status !== 'rework_requested') return false;
    }

    if (filterDateFrom && submitted) {
      if (new Date(submitted) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo && submitted) {
      if (new Date(submitted) > new Date(filterDateTo)) return false;
    }

    return true;
  });

  const uniqueCrops = Array.from(new Set(tasks.map(t => t.crop_name || t.livestock_name || 'N/A')));

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
        setFormData({ title: '', description: '', cropCycleId: '', livestockGroupId: '', assignedToUserId: '', priority: 'medium', session: 'morning', dueDate: '', attachmentUrl: '', attachmentName: '' });
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

      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card className="bg-amber-500/10 border-amber-500/20">
          <h4 className="text-amber-400 text-sm font-bold uppercase tracking-wider">Pending Evidence Reviews</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => getDisplayStatus(t) === 'waiting_manager_approval').length}</p>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <h4 className="text-red-400 text-sm font-bold uppercase tracking-wider">High Risk Evidence</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => getRiskLevel(t).includes('High')).length}</p>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <h4 className="text-emerald-400 text-sm font-bold uppercase tracking-wider">Verified Evidence</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => getDisplayStatus(t) === 'approved' || getDisplayStatus(t) === 'completed').length}</p>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20">
          <h4 className="text-orange-400 text-sm font-bold uppercase tracking-wider">Rework Requests</h4>
          <p className="text-3xl font-black text-white mt-2">{tasks.filter(t => getDisplayStatus(t) === 'rework_requested').length}</p>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <h4 className="text-blue-400 text-sm font-bold uppercase tracking-wider">Avg Verification Score</h4>
          <p className="text-3xl font-black text-white mt-2">
            {Math.round(tasks.reduce((acc, t) => acc + getEvidenceScore(t), 0) / (tasks.filter(t => getEvidenceScore(t) > 0).length || 1))}%
          </p>
        </Card>
      </div>

      <Card title={t("Task Evidence Review")} subtitle={t("Manage and verify submitted task evidence")}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-3">
             <input type="text" placeholder="Search Worker" value={filterWorker} onChange={e => setFilterWorker(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
             <input type="text" placeholder="Search Task" value={filterTask} onChange={e => setFilterTask(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
             <select value={filterCrop} onChange={e => setFilterCrop(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                <option value="All">All Crops</option>
                {uniqueCrops.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                <option value="All">All Risks</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
             </select>
             <select value={filterVerification} onChange={e => setFilterVerification(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                <option value="All">All Verification</option>
                <option value="Verified">Verified</option>
                <option value="Warning">Warning</option>
                <option value="High Risk">High Risk</option>
                <option value="Rejected">Rejected</option>
             </select>
             <select value={filterReview} onChange={e => setFilterReview(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                <option value="All">All Reviews</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Rework Requested">Rework Requested</option>
             </select>
             <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]" />
             <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]" />
          </div>
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 whitespace-nowrap">
            <FiPlus className="text-lg" /> {t("Assign Task")}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-4 py-3">{t("Worker")}</th>
                <th className="px-4 py-3">{t("Task")}</th>
                <th className="px-4 py-3">{t("Crop")}</th>
                <th className="px-4 py-3">{t("Activity")}</th>
                <th className="px-4 py-3">{t("Shift")}</th>
                <th className="px-4 py-3">{t("Submitted Date")}</th>
                <th className="px-4 py-3">{t("Working Hours")}</th>
                <th className="px-4 py-3 text-center">{t("Verification Score")}</th>
                <th className="px-4 py-3 text-center">{t("Risk Level")}</th>
                <th className="px-4 py-3 text-center">{t("Review Status")}</th>
                <th className="px-4 py-3 text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/60">
               {loading ? (
                 <tr><td colSpan={11} className="px-4 py-4 text-center text-slate-500">Loading tasks...</td></tr>
               ) : filteredTasks.length === 0 ? (
                 <tr><td colSpan={11} className="px-4 py-4 text-center text-slate-500">{t("No tasks found")}</td></tr>
               ) : (
                filteredTasks.map(task => {
                  const riskLevel = getRiskLevel(task);
                  const isHighRisk = riskLevel.includes('High');
                  const score = getEvidenceScore(task);
                  
                  return (
                  <tr key={task.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{task.assigned_to_name || 'Unassigned'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white max-w-[150px] truncate" title={task.title}>{task.title}</span>
                        {(task.needs_manager_review || getDisplayStatus(task) === 'waiting_manager_approval' || getDisplayStatus(task) === 'late_submission') && (
                          <FiAlertTriangle className="text-amber-500 shrink-0" title="Needs Manager Review" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{task.crop_name || task.livestock_name || 'N/A'}</td>
                    <td className="px-4 py-3">{task.activity_type || 'N/A'}</td>
                    <td className="px-4 py-3 capitalize">{task.session || 'morning'}</td>
                    <td className="px-4 py-3">{task.latest_update?.created_at ? new Date(task.latest_update.created_at).toLocaleString() : 'N/A'}</td>
                    <td className="px-4 py-3">
                      {task.started_at && task.completed_at ? 
                        ((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / (1000 * 60 * 60)).toFixed(1) + 'h' 
                      : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${score >= 90 ? 'bg-emerald-500/20 text-emerald-400' : score >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                         {score}%
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${isHighRisk ? 'bg-red-500/20 text-red-400' : riskLevel.includes('Medium') ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                         {riskLevel}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        getDisplayStatus(task) === 'completed' || getDisplayStatus(task) === 'approved' || getDisplayStatus(task) === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        getDisplayStatus(task) === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        getDisplayStatus(task) === 'waiting_manager_approval' || getDisplayStatus(task) === 'waiting_for_manager_approval' ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{String(getDisplayStatus(task)).replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {task.latest_update || getDisplayStatus(task) === 'waiting_manager_approval' || getDisplayStatus(task) === 'waiting_for_manager_approval' || getDisplayStatus(task) === 'completed' || getDisplayStatus(task) === 'approved' || task.total_updates > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            const status = getDisplayStatus(task);
                            if (status === 'completed' || status === 'approved' || status === 'done') {
                              navigate('/dashboard/farm-manager/recent-updates', { state: { taskId: task.id } });
                            } else {
                              navigate(`/dashboard/farm-manager/tasks/${task.id}/review`);
                            }
                          }}
                          className="!px-3 !py-1 text-slate-200 hover:text-white text-xs whitespace-nowrap"
                        >
                          View Evidence
                        </Button>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                )})
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

              {formData.attachmentUrl && (
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <FiFileText size={18} />
                    <span className="font-medium truncate max-w-[200px]">{formData.attachmentName || 'Attached Document'}</span>
                  </div>
                  <a href={formData.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:text-emerald-200 underline">
                    {t("View")}
                  </a>
                </div>
              )}

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
                    {crops
                      .filter(c => 
                        String(c.status || '').toLowerCase() !== 'harvested' && 
                        String(c.status || '').toLowerCase() !== 'completed' && 
                        String(c.harvest_status || '').toLowerCase() !== 'harvested'
                      )
                      .map(c => (
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
