import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { AssignTaskModal } from '../../components/tasks/AssignTaskModal';
import { FiPlus, FiAlertTriangle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';

export default function FarmManagerTasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<{ title?: string; description?: string; attachmentUrl?: string; attachmentName?: string }>({});
  const [loading, setLoading] = useState(true);
  const [filterWorker, setFilterWorker] = useState('');
  const [filterTask, setFilterTask] = useState('');
  const [filterCrop, setFilterCrop] = useState('All');
  const [filterRisk, setFilterRisk] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

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

  // working_hours is not always stamped on submission, so fall back to the real
  // start -> final-evidence window before giving up.
  const getWorkingHours = (task: any) => {
    const stored = Number(task.working_hours);
    if (Number.isFinite(stored) && stored > 0) return `${stored.toFixed(2)}h`;

    if (!task.started_at) return '-';
    const endRaw = task.completed_at || task.end_time || task.latest_update?.created_at || task.updated_at;
    if (!endRaw) return '-';

    const hours = (new Date(endRaw).getTime() - new Date(task.started_at).getTime()) / (1000 * 60 * 60);
    if (!Number.isFinite(hours) || hours <= 0) return '-';
    return `${hours.toFixed(2)}h`;
  };

  const getRiskLevel = (task: any) => {
    const score = getEvidenceScore(task);
    return score >= 90 ? 'Low Risk' : score >= 70 ? 'Medium Risk' : 'High Risk';
  };

  const fetchData = async () => {
    try {
      const [tasksRes, cropsRes, workersRes, shiftsRes] = await Promise.all([
        apiFetch('/api/tasks/manager'),
        apiFetch('/api/crops'),
        apiFetch('/api/tasks/workers'),
        apiFetch('/api/shifts')
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.filter((t: any) => !t.livestock_group_id));
      }

      if (cropsRes.ok) {
        const cropsData = await cropsRes.json();
        setCrops(cropsData);
      }

      if (workersRes.ok) {
        const workersData = await workersRes.json();
        setFarmers(workersData);
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
      setTaskPrefill({
        title: location.state.prefillTitle || '',
        description: location.state.prefillDescription || '',
        attachmentUrl: location.state.prefillAttachmentUrl || '',
        attachmentName: location.state.prefillAttachmentName || ''
      });
      setShowModal(true);

      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, crops]);

  
  const filteredTasks = tasks.filter(task => {
    const risk = getRiskLevel(task);
    const workerName = String(task.assigned_to_name || '').toLowerCase();
    const taskName = String(task.title || '').toLowerCase();
    const crop = String(task.crop_name || 'N/A');
    const submitted = task.latest_update?.created_at;

    if (filterWorker && !workerName.includes(filterWorker.toLowerCase())) return false;
    if (filterTask && !taskName.includes(filterTask.toLowerCase())) return false;
    if (filterCrop !== 'All' && crop !== filterCrop) return false;
    
    if (filterRisk !== 'All') {
      if (filterRisk === 'High' && risk !== 'High Risk') return false;
      if (filterRisk === 'Medium' && risk !== 'Medium Risk') return false;
      if (filterRisk === 'Low' && risk !== 'Low Risk') return false;
    }

    if (filterDateFrom && submitted) {
      if (new Date(submitted) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo && submitted) {
      if (new Date(submitted) > new Date(filterDateTo)) return false;
    }

    return true;
  });

  const uniqueCrops = Array.from(new Set(tasks.map(t => t.crop_name || 'N/A')));

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
                 <tr><td colSpan={10} className="px-4 py-4 text-center text-slate-500">Loading tasks...</td></tr>
               ) : filteredTasks.length === 0 ? (
                 <tr><td colSpan={10} className="px-4 py-4 text-center text-slate-500">{t("No tasks found")}</td></tr>
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
                    <td className="px-4 py-3">{task.crop_name || 'N/A'}</td>
                    <td className="px-4 py-3 capitalize">{task.session || 'morning'}</td>
                    <td className="px-4 py-3">{task.latest_update?.created_at ? new Date(task.latest_update.created_at).toLocaleString() : 'N/A'}</td>
                    <td className="px-4 py-3">{getWorkingHours(task)}</td>
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


      <AssignTaskModal
        mode="crop"
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={fetchData}
        farmers={farmers}
        shifts={shifts}
        relatedOptions={crops}
        prefill={taskPrefill}
      />
    </div>
  );
}
