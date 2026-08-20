import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AssignTaskModal } from '../../components/tasks/AssignTaskModal';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiDroplet, FiDownload, FiMessageCircle, FiFileText, FiAlertTriangle } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteFeedRequirement, getFeedRequirements, upsertFeedRequirement, getFeedLogs, getFeedWeatherAdvice, type FeedRequirement, type FeedLog, type FeedWeatherAdvice } from '../../api/livestock';
import { createLivestockHealthEvent, getLivestockHealthEvents, type LivestockHealthEvent } from '../../api/livestockHealth';
import html2pdf from 'html2pdf.js';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { apiFetch } from '../../utils/apiFetch';

export default function FarmManagerLivestockPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState((location.state as any)?.activeTab || 'overview');
  const [livestock, setLivestock] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [feedConfigs, setFeedConfigs] = useState<FeedRequirement[]>([]);
  const [healthEvents, setHealthEvents] = useState<LivestockHealthEvent[]>([]);
  const [feedLogs, setFeedLogs] = useState<FeedLog[]>([]);
  const [feedAdvice, setFeedAdvice] = useState<FeedWeatherAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState('');
  const [livestockTasks, setLivestockTasks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [animalToDelete, setAnimalToDelete] = useState<any | null>(null);
  const [revealedTreatments, setRevealedTreatments] = useState<Record<string, boolean>>({});

  // Form State
  const [formData, setFormData] = useState({
    tagCode: '',
    groupId: '',
    dob: '',
    healthStatus: 'healthy',
    sex: '',
    weight: '',
    acquisitionDate: '',
    notes: ''
  });

  const [feedForm, setFeedForm] = useState({
    animalType: '',
    breedOrVariety: '',
    feedType: '',
    dailyFeedAmount: '',
    dailyWaterRequirement: '',
    unit: 'kg/day',
  });

  const [healthForm, setHealthForm] = useState({
    livestockId: '',
    healthIssue: '',
    symptoms: '',
    diagnosis: '',
    treatment: '',
    vaccinationDetails: '',
    eventDate: '',
    status: 'Healthy',
  });

  const fetchLivestock = async () => {
  try {
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') && tokenRaw.endsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
    if (!token) {
      console.warn('No auth token found, skipping livestock fetch');
      setLivestock([]);
      setLoading(false);
      return;
    }
    const res = await fetch('/api/livestock', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setLivestock(data);
    } else {
      console.error('Failed to fetch livestock:', res.status);
    }
} catch (err) {
  console.error('Failed to fetch livestock:', err);
}  
  };

  const handleExportPDF = (record: any) => {
    const element = document.getElementById(`treatment-review-${record.id}`);
    if (element) {
      const opt = {
  margin: 10,
  filename: `treatment_review_${record.animalTag || record.livestockId}.pdf`,
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
};
      html2pdf().set(opt).from(element).save();
    }
  };

  const fetchGroups = async () => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') && tokenRaw.endsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch('/api/livestock/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      } else {
        console.error('Failed to fetch groups, status:', res.status);
        // Fallback default groups
        setGroups([
          { id: 'default-cow', group_code: 'COW', species: 'Cattle' },
          { id: 'default-hen', group_code: 'HEN', species: 'Poultry' },
          { id: 'default-duck', group_code: 'DUCK', species: 'Poultry' }
        ]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      // Fallback default groups
      setGroups([
        { id: 'default-cow', group_code: 'COW', species: 'Cattle' },
        { id: 'default-hen', group_code: 'HEN', species: 'Poultry' },
        { id: 'default-duck', group_code: 'DUCK', species: 'Poultry' }
      ]);
    }
  };

  const fetchFeedConfigs = async () => {
    try {
      const data = await getFeedRequirements();
      setFeedConfigs(data);
    } catch (error) {
      console.error('Failed to fetch feed requirements:', error);
    }
  };

  const fetchHealthEvents = async () => {
    try {
      const data = await getLivestockHealthEvents();
      setHealthEvents(data);
    } catch (error) {
      console.error('Failed to fetch livestock health events:', error);
    }
  };

  const fetchLivestockTasks = async () => {
    try {
      const res = await apiFetch('/api/tasks/manager');
      if (res.ok) {
        const data = await res.json();
        setLivestockTasks(data.filter((t: any) => !!t.livestock_group_id));
      }
    } catch (error) {
      console.error('Failed to fetch livestock tasks:', error);
    }
  };

  const fetchFarmers = async () => {
    try {
      const res = await apiFetch('/api/tasks/workers');
      if (res.ok) {
        const data = await res.json();
        setFarmers(data);
      }
    } catch (error) {
      console.error('Failed to fetch farmers:', error);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await apiFetch('/api/shifts');
      if (res.ok) {
        const data = await res.json();
        setShifts(data);
      }
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    }
  };

  const fetchFeedLogs = async () => {
    try {
      const data = await getFeedLogs();
      setFeedLogs(data);
    } catch (error) {
      console.error('Failed to fetch feed logs:', error);
    }
  };

  // The advice depends on today's weather, so it is fetched when the Feed tab is
  // opened rather than on every page load.
  const fetchFeedAdvice = async () => {
    try {
      setAdviceLoading(true);
      setAdviceError('');
      const data = await getFeedWeatherAdvice(i18n.language || 'en');
      setFeedAdvice(data);
    } catch (error) {
      console.error('Failed to load feeding advice:', error);
      setAdviceError('Weather advice is unavailable right now.');
    } finally {
      setAdviceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview' && !feedAdvice && !adviceLoading) {
      fetchFeedAdvice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchGroups();
      await fetchLivestock();
      await fetchFeedConfigs();
      await fetchHealthEvents();
      await fetchLivestockTasks();
      await fetchFarmers();
      await fetchShifts();
      await fetchFeedLogs();
      setLoading(false);
    };
    loadData();
  }, []);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedGroupId = e.target.value;
    
    setFormData(prev => ({
      ...prev,
      groupId: selectedGroupId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const cleanToken = token && token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token;
      
      const url = isEditing 
        ? `/api/livestock/${editingId}`
        : '/api/livestock';
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanToken}`
        },
        body: JSON.stringify({
          tagCode: formData.tagCode,
          groupId: formData.groupId,
          dob: formData.dob,
          healthStatus: formData.healthStatus,
          sex: formData.sex,
          weight: formData.weight,
          acquisitionDate: formData.acquisitionDate,
          notes: formData.notes
        })
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ tagCode: '', groupId: '', dob: '', healthStatus: 'healthy', sex: '', weight: '', acquisitionDate: '', notes: '' });
        setIsEditing(false);
        setEditingId(null);
        fetchLivestock(); // Refresh the list
        notifySuccess(isEditing ? 'Animal updated successfully.' : 'Animal added successfully.');
      } else {
        const errorData = await res.json();
        notifyError(errorData.error || `Failed to ${isEditing ? 'update' : 'add'} animal`);
      }
    } catch (err) {
      console.error('Submit error:', err);
      notifyError('An error occurred while saving.');
    }
  };

  const handleEdit = (animal: any) => {
    setFormData({
      tagCode: animal.id, // we mapped tag_code to id in getLivestock
      groupId: groups.find(g => g.group_code === animal.pen)?.id || '',
      dob: animal.dob !== 'Unknown' ? animal.dob : '',
      healthStatus: animal.health.toLowerCase(),
      sex: animal.sex !== 'Unknown' ? animal.sex : '',
      weight: animal.weight !== 'N/A' ? animal.weight : '',
      acquisitionDate: animal.acquisitionDate !== 'N/A' ? animal.acquisitionDate : '',
      notes: animal.notes || ''
    });
    setEditingId(animal.dbId);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (dbId: string) => {
    try {
      const token = localStorage.getItem('token');
      const cleanToken = token && token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token;
      const res = await fetch(`/api/livestock/${dbId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cleanToken}` }
      });

      if (res.ok) {
        fetchLivestock();
        notifySuccess('Animal deleted successfully.');
      } else {
        const errorData = await res.json();
        notifyError(errorData.error || 'Failed to delete animal');
      }
    } catch (err) {
      console.error('Delete error:', err);
      notifyError('An error occurred while deleting.');
    }
  };

  const handleFeedEdit = (config: FeedRequirement) => {
    setEditingFeedId(config.id);
    setFeedForm({
      animalType: config.animalType,
      breedOrVariety: config.breedOrVariety,
      feedType: config.feedType,
      dailyFeedAmount: config.dailyFeedAmount,
      dailyWaterRequirement: config.dailyWaterRequirement,
      unit: config.unit,
    });
    setShowFeedModal(true);
  };

  const handleFeedSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const saved = await upsertFeedRequirement(editingFeedId, feedForm);
      setFeedConfigs((prev) => {
        const next = [...prev];
        const index = next.findIndex((item) => item.id === saved.id);
        if (index >= 0) {
          next[index] = saved;
          return next;
        }
        return [saved, ...next];
      });
      setShowFeedModal(false);
      setEditingFeedId(null);
      notifySuccess('Feed requirement saved successfully.');
    } catch (error) {
      console.error('Failed to save feed requirement:', error);
      notifyError('Failed to save feed requirement.');
    }
  };

  const handleFeedDelete = async (id: string) => {
    try {
      await deleteFeedRequirement(id);
      setFeedConfigs((prev) => prev.filter((item) => item.id !== id));
      notifySuccess('Feed requirement deleted successfully.');
    } catch (error) {
      console.error('Failed to delete feed requirement:', error);
      notifyError('Failed to delete feed requirement.');
    }
  };

  const handleHealthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const saved = await createLivestockHealthEvent(healthForm);
      setHealthEvents((prev) => [saved, ...prev]);
      setHealthForm({
        livestockId: '',
        healthIssue: '',
        symptoms: '',
        diagnosis: '',
        treatment: '',
        vaccinationDetails: '',
        eventDate: '',
        status: 'Healthy',
      });
      notifySuccess('Livestock health record saved successfully.');
    } catch (error) {
      console.error('Failed to save livestock health event:', error);
      notifyError('Failed to save livestock health record.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t("Livestock Management")}
        title={t("Livestock")}
        description={t("Track animal health, feed schedules, and pen allocations.")}
        tone="light"
      />

      {/* Tabs */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['overview', 'list', 'task', 'health'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'
            }`}
          >
            {tab === 'overview' ? t('Overview') : t(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-4">
          <Card title={t("Total Animals")} subtitle={t("All registered livestock")}>
            <p className="text-5xl font-black text-emerald-400 mt-2">{livestock.length}</p>
          </Card>
          <Card title={t("Sick Animals")} subtitle={t("Needs attention")}>
            <p className="text-5xl font-black text-rose-500 mt-2">
              {livestock.filter(l => l.health?.toLowerCase() === 'sick').length}
            </p>
          </Card>
          <Card title={t("Under Treatment")} subtitle={t("Currently receiving care")}>
            <p className="text-5xl font-black text-amber-500 mt-2">
              {livestock.filter(l => l.health?.toLowerCase() === 'treatment').length}
            </p>
          </Card>
          <Card title={t("Today's Feed Tasks")} subtitle={t("Pending feed deliveries")}>
            <p className="text-5xl font-black text-lime-400 mt-2">3</p>
          </Card>
          </div>

          {/* Feeding lives here rather than in its own tab, so the day's plan
              sits next to the herd's headline numbers. */}
          <div className="space-y-6">
          <FeedWeatherAdvicePanel
            advice={feedAdvice}
            loading={adviceLoading}
            error={adviceError}
            onRefresh={fetchFeedAdvice}
            t={t}
          />
          <Card title={t("Feed Management")} subtitle={t("View feeding requirements and edit feed settings per animal type")}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {feedConfigs.map((config) => (
                <div key={config.id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">{config.animalType}</p>
                      <h4 className="mt-2 text-xl font-bold text-white">{config.breedOrVariety}</h4>
                    </div>
                    <FiDroplet className="text-2xl text-emerald-300" />
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="rounded-2xl bg-white/5 px-4 py-3">Feed: <span className="font-semibold text-white">{config.dailyFeedAmount}</span></div>
                    <div className="rounded-2xl bg-white/5 px-4 py-3">Water: <span className="font-semibold text-white">{config.dailyWaterRequirement}</span></div>
                    <div className="rounded-2xl bg-white/5 px-4 py-3">Type: <span className="font-semibold text-white">{config.feedType}</span></div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleFeedEdit(config)}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                    >
                      <FiEdit2 /> Edit
                    </button>
                    {!config.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleFeedDelete(config.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
                      >
                        <FiTrash2 /> Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Feeding Logs" subtitle="Completed feedings and differences">
            <div className="space-y-3">
              {feedLogs.length === 0 ? (
                <p className="text-sm text-slate-400">No feeding logs yet.</p>
              ) : feedLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{log.animalTag || log.livestock_id}</p>
                      <p className="mt-1 text-xs text-slate-400">{log.feeding_session}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{log.status}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <span>Feed: {log.feed_given}/{log.feed_required}</span>
                    <span>Water: {log.water_given}/{log.water_required}</span>
                    <span>Difference: {log.difference_feed} kg</span>
                    <span>Worker: {log.workerName || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <Card title={t("Livestock List")} subtitle={t("Manage all animals across pens")}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search by species or pen...")}
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
              />
            </div>
            <Button onClick={() => {
              setIsEditing(false);
              setEditingId(null);
              setFormData({ tagCode: '', groupId: '', dob: '', healthStatus: 'healthy', sex: '', weight: '', acquisitionDate: '', notes: '' });
              setShowModal(true);
            }} className="flex items-center gap-2 whitespace-nowrap">
              <FiPlus className="text-lg" /> {t("Add Animal")}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-white font-semibold">
                <tr>
                  <th className="px-6 py-4">{t("ID (Tag)")}</th>
                  <th className="px-6 py-4">{t("Group/Pen")}</th>
                  <th className="px-6 py-4">{t("DOB")}</th>
                  <th className="px-6 py-4">{t("Sex")}</th>
                  <th className="px-6 py-4">{t("Weight")}</th>
                  <th className="px-6 py-4">{t("Acquisition Date")}</th>
                  <th className="px-6 py-4">{t("Notes")}</th>
                  <th className="px-6 py-4">{t("Health")}</th>
                  <th className="px-6 py-4 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/60">
                 {loading ? (
                   <tr><td colSpan={9} className="px-6 py-4 text-center text-slate-500">Loading livestock...</td></tr>
                 ) : livestock.length === 0 ? (
                   <tr><td colSpan={9} className="px-6 py-4 text-center text-slate-500">No livestock found. Click 'Add Animal' to create one.</td></tr>
                 ) : (
                  livestock.map(l => (
                    <tr key={l.dbId || l.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-emerald-400">{l.id}</td>
                       <td className="px-6 py-4">
                         <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">{l.pen}</span>
                       </td>
                       <td className="px-6 py-4">{l.dob}</td>
                       <td className="px-6 py-4">{l.sex}</td>
                       <td className="px-6 py-4">{l.weight}</td>
                       <td className="px-6 py-4">{l.acquisitionDate}</td>
                       <td className="px-6 py-4">{l.notes}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            l.health?.toLowerCase() === 'healthy'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : l.health?.toLowerCase() === 'sick' || l.health?.toLowerCase() === 'treatment'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}
                        >
                          {t(l.health)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-4">
                        <button 
                          onClick={() => handleEdit(l)}
                          className="text-blue-400 hover:text-blue-300 transition-colors" 
                          title="Edit"
                        >
                          <FiEdit2 className="text-lg" />
                        </button>
                        <button 
                          onClick={() => setAnimalToDelete(l)}
                          className="text-rose-400 hover:text-rose-300 transition-colors" 
                          title="Delete"
                        >
                          <FiTrash2 className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'task' && (
        <Card title={t("Livestock Tasks")} subtitle={t("Assign and track tasks against livestock groups")}>
          <div className="flex justify-end mb-6">
            <Button onClick={() => setShowTaskModal(true)} className="flex items-center gap-2 whitespace-nowrap">
              <FiPlus className="text-lg" /> {t("Assign Livestock Task")}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-white font-semibold">
                <tr>
                  <th className="px-4 py-3">{t("Worker")}</th>
                  <th className="px-4 py-3">{t("Task")}</th>
                  <th className="px-4 py-3">{t("Livestock Group")}</th>
                  <th className="px-4 py-3">{t("Shift")}</th>
                  <th className="px-4 py-3">{t("Due Date")}</th>
                  <th className="px-4 py-3 text-center">{t("Status")}</th>
                  <th className="px-4 py-3 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/60">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500">Loading tasks...</td></tr>
                ) : livestockTasks.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500">{t("No livestock tasks found")}</td></tr>
                ) : (
                  livestockTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{task.assigned_to_name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white max-w-[150px] truncate" title={task.title}>{task.title}</span>
                          {task.needs_manager_review && (
                            <FiAlertTriangle className="text-amber-500 shrink-0" title="Needs Manager Review" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{task.livestock_name || 'N/A'}</td>
                      <td className="px-4 py-3 capitalize">{task.session || 'morning'}</td>
                      <td className="px-4 py-3">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {String(task.status || 'pending').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate(`/dashboard/farm-manager/tasks/${task.id}/review`)}
                          className="!px-3 !py-1 text-slate-200 hover:text-white text-xs whitespace-nowrap"
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'health' && (
        <div className="grid gap-6">
          <Card title={t("Health History")} subtitle={t("Recent animal health records")}>
            <div className="space-y-3">
              {healthEvents.length === 0 ? (
                <p className="text-sm text-slate-400">{t("No health records yet.")}</p>
              ) : (
                healthEvents.map((record) => (
                  <div key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{record.animalTag || record.livestockId}</p>
                        <p className="mt-1 text-xs text-slate-400">{record.healthIssue}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{record.status}</span>
                    </div>
                    {/* @ts-ignore */}
                    {record.imageUrl && (
                      <div className="mt-3 relative group">
                        {/* @ts-ignore */}
                        <img src={record.imageUrl} alt="Health condition" className="h-32 w-full object-cover rounded-xl" />
                        {/* @ts-ignore */}
                        <a href={record.imageUrl} download="health_condition.jpg" className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <FiDownload size={16} />
                        </a>
                      </div>
                    )}
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                      <span>{t("Symptoms")}: {record.symptoms || '-'}</span>
                      <span>{t("Vaccination")}: {record.vaccinationDetails || '-'}</span>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button 
                        onClick={() => navigate('/dashboard/farm-manager/ai-chat', { state: { livestockSymptoms: record.symptoms, animal: record.animalTag || record.livestockId, imageUrl: record.imageUrl } })}
                        className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 text-xs py-1"
                      >
                        <FiMessageCircle className="mr-1 inline" /> AI Assist
                      </Button>
                      <Button 
                        onClick={() => setRevealedTreatments(prev => ({ ...prev, [record.id!]: !prev[record.id!] }))}
                        className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs py-1"
                      >
                        <FiFileText className="mr-1 inline" /> {revealedTreatments[record.id!] ? "Hide Review" : "Review Treatment"}
                      </Button>
                    </div>

                    {revealedTreatments[record.id!] && (
                      <div id={`treatment-review-${record.id}`} className="mt-3 rounded-xl bg-slate-900/80 p-3 border border-slate-700/50">
                        <div className="mb-2 flex items-center justify-between text-emerald-400 font-medium text-xs">
                          <div className="flex items-center gap-2">
                            <FiFileText /> Treatment Review
                          </div>
                          <button 
                            onClick={() => handleExportPDF(record)} 
                            className="flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                          >
                            <FiDownload /> PDF
                          </button>
                        </div>
                        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                          <span><strong>{t("Diagnosis")}:</strong> {record.diagnosis || '-'}</span>
                          <span><strong>{t("Treatment")}:</strong> {record.treatment || '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      <AssignTaskModal
        mode="livestock"
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onCreated={fetchLivestockTasks}
        farmers={farmers}
        shifts={shifts}
        // Only groups that actually have animals registered can be assigned work.
        relatedOptions={groups.filter((g) => Number(g.animal_count || 0) > 0)}
      />

      {showFeedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-6 text-2xl font-bold text-white">{t("Edit Feed Requirement")}</h3>
            <form onSubmit={handleFeedSave} className="grid gap-4 md:grid-cols-2">
              <input className="farm-input md:col-span-1" value={feedForm.animalType} onChange={(e) => setFeedForm((prev) => ({ ...prev, animalType: e.target.value }))} placeholder={t("Animal type")} />
              <input className="farm-input md:col-span-1" value={feedForm.breedOrVariety} onChange={(e) => setFeedForm((prev) => ({ ...prev, breedOrVariety: e.target.value }))} placeholder={t("Breed / variety")} />
              <input className="farm-input md:col-span-2" value={feedForm.feedType} onChange={(e) => setFeedForm((prev) => ({ ...prev, feedType: e.target.value }))} placeholder={t("Feed type")} />
              <input className="farm-input" value={feedForm.dailyFeedAmount} onChange={(e) => setFeedForm((prev) => ({ ...prev, dailyFeedAmount: e.target.value }))} placeholder={t("Daily feed amount")} />
              <input className="farm-input" value={feedForm.dailyWaterRequirement} onChange={(e) => setFeedForm((prev) => ({ ...prev, dailyWaterRequirement: e.target.value }))} placeholder={t("Daily water requirement")} />
              <input className="farm-input md:col-span-2" value={feedForm.unit} onChange={(e) => setFeedForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder={t("Unit")} />
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowFeedModal(false)}>{t("Cancel")}</Button>
                <Button type="submit" className="border-0 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-600 text-white shadow-[0_16px_40px_rgba(16,185,129,0.28)] hover:from-emerald-400 hover:via-lime-300 hover:to-emerald-500">{t("Save Changes")}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Livestock Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-white mb-6">
              {isEditing ? t('Edit Animal') : t('Add New Animal')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Tag Code (ID)")} *</label>
                <input
                  type="text"
                  required
                  value={formData.tagCode}
                  onChange={e => setFormData({...formData, tagCode: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. COW-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Livestock Group")} *</label>
                <select
                  required
                  value={formData.groupId}
                  onChange={handleGroupChange}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="" disabled>Select a group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.group_code} ({g.species})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Date of Birth")}</label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={e => setFormData({...formData, dob: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t("Health Status")}</label>
                <select
                  value={formData.healthStatus}
                  onChange={e => setFormData({...formData, healthStatus: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="healthy">{t("Healthy")}</option>
                  <option value="treatment">{t("Under Treatment")}</option>
                  <option value="sick">{t("Sick")}</option>
                </select>
              </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Sex")} *</label>
                  <select
                    required
                    name="sex"
                    value={formData.sex || ''}
                    onChange={e => setFormData({ ...formData, sex: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled>{t("Select sex...")}</option>
                    <option value="Male">{t("Male")}</option>
                    <option value="Female">{t("Female")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Current Weight (kg)")}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    name="weight"
                    value={formData.weight || ''}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. 350"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Acquisition Date")}</label>
                  <input
                    type="date"
                    name="acquisitionDate"
                    value={formData.acquisitionDate || ''}
                    onChange={e => setFormData({ ...formData, acquisitionDate: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{t("Notes")}</label>
                  <textarea
                    rows={3}
                    name="notes"
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Additional information..."
                  />
                </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
                <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>{t("Cancel")}</Button>
                <Button type="submit">{t("Save Animal")}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(animalToDelete)}
        title="Delete livestock?"
        description={animalToDelete ? `Are you sure you want to delete ${animalToDelete.id}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setAnimalToDelete(null)}
        onConfirm={async () => {
          if (!animalToDelete) return;
          await handleDelete(animalToDelete.dbId);
          setAnimalToDelete(null);
        }}
      />
    </div>
  );
}

const STRESS_STYLES: Record<string, { chip: string; label: string }> = {
  none: { chip: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30', label: 'Comfortable' },
  mild: { chip: 'bg-lime-400/15 text-lime-200 border-lime-400/30', label: 'Mild heat stress' },
  moderate: { chip: 'bg-amber-400/15 text-amber-200 border-amber-400/30', label: 'Moderate heat stress' },
  severe: { chip: 'bg-orange-500/15 text-orange-200 border-orange-500/30', label: 'Severe heat stress' },
  emergency: { chip: 'bg-rose-500/20 text-rose-200 border-rose-500/40', label: 'Emergency' },
  unknown: { chip: 'bg-white/10 text-white/70 border-white/20', label: 'Unknown' },
};

// Shows how much extra water and feed today's weather calls for. The figures
// come from the server's heat-stress calculation; the AI text only explains them.
function FeedWeatherAdvicePanel({
  advice, loading, error, onRefresh, t,
}: {
  advice: FeedWeatherAdvice | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  t: (key: string) => string;
}) {
  const weather = advice?.weather;

  return (
    <Card
      title={t('Weather-based feeding advice')}
      subtitle={t("How much extra water and feed today's weather calls for")}
      action={
        <Button variant="ghost" onClick={onRefresh} disabled={loading} className="!px-4 !py-2 text-xs">
          {loading ? t('Checking...') : t('Refresh')}
        </Button>
      }
    >
      {loading && !advice ? (
        <p className="text-sm text-slate-300">{t('Reading the weather and working out adjustments...')}</p>
      ) : error ? (
        <p className="text-sm text-amber-300">{error}</p>
      ) : !advice ? null : (
        <div className="space-y-5">
          {weather && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <span className="text-2xl font-black text-white">{Math.round(weather.temperature)}&deg;C</span>
              <span className="text-sm capitalize text-slate-300">{weather.description}</span>
              <span className="text-sm text-slate-400">{t('Humidity')} {Math.round(weather.humidity)}%</span>
              <span className="text-sm text-slate-400">{t('Wind')} {weather.windSpeed} m/s</span>
            </div>
          )}

          {advice.narrative?.headline && (
            <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              {advice.narrative.headline}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {advice.rows.map((row) => {
              const style = STRESS_STYLES[row.stress_level] || STRESS_STYLES.unknown;
              const aiText = advice.narrative?.groups?.find(
                (group) => group.animal?.toLowerCase().includes(String(row.breed).toLowerCase()),
              )?.advice;

              return (
                <div key={row.id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">{row.animal_type}</p>
                      <h4 className="mt-1 text-lg font-bold text-white">{row.breed}</h4>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}>
                      {t(style.label)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <AdjustmentTile
                      label={t('Water')}
                      percent={row.water_change_percent}
                      amount={row.extra_water}
                      unit={row.water_unit}
                      base={row.base_water}
                      positiveIsGood
                    />
                    <AdjustmentTile
                      label={t('Feed')}
                      percent={row.feed_change_percent}
                      amount={row.extra_feed}
                      unit={row.feed_unit}
                      base={row.base_feed}
                    />
                  </div>

                  {aiText && <p className="mt-4 text-sm leading-relaxed text-slate-200">{aiText}</p>}

                  <ul className="mt-3 space-y-1.5">
                    {row.reasons.map((reason, index) => (
                      <li key={index} className="flex gap-2 text-xs text-slate-400">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>

                  {row.thi !== null && row.kind === 'ruminant' && (
                    <p className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">THI {row.thi}</p>
                  )}
                </div>
              );
            })}
          </div>

          {advice.tomorrow && (
            <div className="rounded-2xl border border-sky-400/25 bg-sky-400/5 px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{t('Tomorrow')}</p>
                <span className="text-sm font-semibold text-white">
                  {Math.round(advice.tomorrow.weather.min_temperature)}&ndash;{Math.round(advice.tomorrow.weather.max_temperature)}&deg;C
                </span>
                <span className="text-sm capitalize text-slate-300">{advice.tomorrow.weather.description}</span>
                {advice.tomorrow.weather.rain_mm > 0 && (
                  <span className="text-sm text-sky-200">{advice.tomorrow.weather.rain_mm} mm {t('rain')}</span>
                )}
              </div>

              {/* Graded on tomorrow's high, since heat stress peaks in the afternoon. */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {advice.tomorrow.rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-white">{row.breed}</span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-300">
                      <span className="text-sky-300">{t('Water')} {row.water_change_percent > 0 ? '+' : ''}{row.water_change_percent}%</span>
                      {' · '}
                      <span className={row.feed_change_percent < 0 ? 'text-amber-300' : 'text-emerald-300'}>
                        {t('Feed')} {row.feed_change_percent > 0 ? '+' : ''}{row.feed_change_percent}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {advice.narrative?.tomorrow && (
                <p className="mt-3 text-sm leading-relaxed text-slate-200">{advice.narrative.tomorrow}</p>
              )}
            </div>
          )}

          {advice.narrative?.general_tips && advice.narrative.general_tips.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">{t("Today's checklist")}</p>
              <ul className="mt-3 space-y-2">
                {advice.narrative.general_tips.map((tip, index) => (
                  <li key={index} className="flex gap-2 text-sm text-slate-200">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!advice.narrative && (
            <p className="text-xs text-slate-500">
              {t('AI explanation unavailable - the amounts above are calculated from heat-stress models.')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function AdjustmentTile({
  label, percent, amount, unit, base, positiveIsGood = false,
}: {
  label: string;
  percent: number;
  amount: number | null;
  unit: string;
  base: number | null;
  positiveIsGood?: boolean;
}) {
  const none = percent === 0;
  const tone = none
    ? 'text-slate-300'
    : percent > 0
      ? (positiveIsGood ? 'text-sky-300' : 'text-emerald-300')
      : 'text-amber-300';

  return (
    <div className="rounded-2xl bg-white/5 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>
        {none ? 'Normal' : `${percent > 0 ? '+' : ''}${percent}%`}
      </p>
      {/* An absolute figure only exists when the stored requirement has a number in it. */}
      {amount !== null && !none && (
        <p className="mt-1 text-xs text-slate-300">
          {amount > 0 ? '+' : ''}{amount} {unit.replace('/day', '')}
          {base !== null && <span className="text-slate-500"> (of {base})</span>}
        </p>
      )}
      {amount === null && !none && (
        <p className="mt-1 text-xs text-slate-500">set a base amount to see litres</p>
      )}
    </div>
  );
}
