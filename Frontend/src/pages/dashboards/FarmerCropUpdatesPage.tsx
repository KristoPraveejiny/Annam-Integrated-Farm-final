import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiUploadCloud, FiSearch, FiLayers, FiDroplet } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';

const activitiesFallback = ['Irrigation', 'Fertilizer Application', 'Pesticide Application', 'Weeding', 'Pruning', 'Harvesting'];
const stages = ['Seed Sowing', 'Germination', 'Vegetative', 'Flowering', 'Fruiting', 'Harvesting'];

export default function FarmerCropUpdatesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('activities');
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  
  // Crop Stage form states
  const [activeCrops, setActiveCrops] = useState<any[]>([]);
  const [selectedCropCycleId, setSelectedCropCycleId] = useState('');
  const [selectedGrowthStage, setSelectedGrowthStage] = useState(stages[0]);
  const [stageNotes, setStageNotes] = useState('');
  
  // Activity form states
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityNotes, setActivityNotes] = useState('');
  const [activityImage, setActivityImage] = useState<File | null>(null);
  
  const [stageImagePreview, setStageImagePreview] = useState<string | null>(null);
  const [diseaseImagePreview, setDiseaseImagePreview] = useState<string | null>(null);
  const [diseaseImage, setDiseaseImage] = useState<File | null>(null);

  // Disease Form states
  const [fields, setFields] = useState<any[]>([]);
  const [selectedDiseaseField, setSelectedDiseaseField] = useState('');
  const [diseaseCrops, setDiseaseCrops] = useState<any[]>([]);
  const [selectedDiseaseCrop, setSelectedDiseaseCrop] = useState('');
  const [diseaseTitle, setDiseaseTitle] = useState('');
  const [diseaseDescription, setDiseaseDescription] = useState('');
  const [diseaseSeverity, setDiseaseSeverity] = useState('Low');
  const [affectedPlants, setAffectedPlants] = useState('');
  const [pastReports, setPastReports] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        
        // Fetch tasks
        const tasksRes = await fetch('/api/tasks/farmer', { headers: { Authorization: `Bearer ${token}` } });
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          const activeTasks = data.filter((t: any) => {
            const status = String(t.status || '').trim().toLowerCase().replace(/\s+/g, '_');
            return status === 'in_progress' && t.crop_cycle_id != null;
          });
          setTasks(activeTasks);
        }

        // Fetch crops
        const cropsRes = await fetch('/api/crops', { headers: { Authorization: `Bearer ${token}` } });
        if (cropsRes.ok) {
          const cropsData = await cropsRes.json();
          const active = cropsData.filter((c: any) => c.status !== 'Harvested');
          setActiveCrops(active);
          if (active.length > 0) {
             setSelectedCropCycleId(active[0].id);
          }
        }
        
        // Fetch fields
        const fieldsRes = await fetch('/api/fields/farm/default', { headers: { Authorization: `Bearer ${token}` } });
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json();
          setFields(fieldsData);
        }
        
        // Fetch past reports
        const reportsRes = await fetch('/api/disease-reports', { headers: { Authorization: `Bearer ${token}` } });
        if (reportsRes.ok) {
           const reportsData = await reportsRes.json();
           setPastReports(reportsData);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDiseaseField) {
       const filtered = activeCrops.filter(c => c.field_id === selectedDiseaseField);
       setDiseaseCrops(filtered);
       if (filtered.length > 0) setSelectedDiseaseCrop(filtered[0].id);
       else setSelectedDiseaseCrop('');
    } else {
       setDiseaseCrops([]);
       setSelectedDiseaseCrop('');
    }
  }, [selectedDiseaseField, activeCrops]);

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

  // Fallback unique crops if tasks have crops but API crops failed
  const uniqueCrops = Array.from(new Set(tasks.filter(t => t.crop_name).map(t => t.crop_name)));

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return notifyWarning('No task selected');

    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

    const formData = new FormData();
    formData.append('notes', activityNotes);
    if (activityImage) {
      formData.append('image', activityImage);
    }

    try {
      const selectedTask = tasks.find((t) => t.id === selectedTaskId);
      const status = String(selectedTask?.status || '').trim().toLowerCase().replace(/\s+/g, '_');

      if (status !== 'in_progress') {
        notifyWarning('Please start the task before submitting activity.');
        return;
      }

      const res = await fetch(`/api/tasks/${selectedTaskId}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notifySuccess('Activity updated successfully!');
        setActivityNotes('');
        setActivityImage(null);
      } else {
        notifyError('Failed to update activity');
      }
    } catch (err) {
      console.error(err);
      notifyError('Error updating activity');
    }
  };

  const handleStageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCropCycleId) return notifyWarning('No crop selected');
    
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

    const body = {
      cropCycleId: selectedCropCycleId,
      growthStage: selectedGrowthStage,
      notes: stageNotes
    };

    try {
      const res = await fetch('/api/crop-observations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
         notifySuccess('Crop stage updated successfully! The Farm Manager has been notified.');
         setStageNotes('');
         setStageImagePreview(null);
      } else {
         notifyError('Failed to update crop stage.');
      }
    } catch(err) {
      notifyError('Error updating crop stage');
    }
  };

  const handleDiseaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiseaseCrop || !selectedDiseaseField) return notifyWarning('Please select a Field and a Crop');
    if (!diseaseTitle || !diseaseDescription) return notifyWarning('Please provide a title and description');

    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

    try {
      const formData = new FormData();
      formData.append('field_id', selectedDiseaseField);
      formData.append('crop_id', selectedDiseaseCrop);
      formData.append('title', diseaseTitle);
      formData.append('description', diseaseDescription);
      formData.append('severity', diseaseSeverity);
      if (affectedPlants) formData.append('affected_plants', affectedPlants);
      
      if (diseaseImage) {
        formData.append('image', diseaseImage);
      }

      const res = await fetch('/api/disease-reports', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}` 
        },
        body: formData
      });
      if (res.ok) {
         notifySuccess('Disease report submitted successfully! The Farm Manager will review it shortly.');
         setDiseaseTitle('');
         setDiseaseDescription('');
         setAffectedPlants('');
         setDiseaseImagePreview(null);
         setDiseaseImage(null);
         
         const reportRes = await fetch('/api/disease-reports', { headers: { Authorization: `Bearer ${token}` } });
         if (reportRes.ok) setPastReports(await reportRes.json());
      } else {
         notifyError('Failed to submit disease report.');
      }
    } catch(err) {
      notifyError('Error submitting disease report');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading eyebrow={t("Crop Updates")} title={t("Crop Management")} description={t("Update crop stages, record daily activities, and report diseases.")} tone="light" />

      {/* Tabs */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['stages', 'activities', 'disease'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]' : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'}`}
          >
            {tab === 'disease' ? t('Disease Reporting') : tab === 'stages' ? t('Crop Stages') : t('Daily Activities')}
          </button>
        ))}
      </div>

      {activeTab === 'stages' && (
        <Card title={t("Update Crop Stage")} subtitle={t("Select crop and update current growth stage")}>
          <form className="space-y-6 mt-4" onSubmit={handleStageSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Select Crop")}</span>
                <select 
                  className="farm-input w-full appearance-none"
                  value={selectedCropCycleId}
                  onChange={e => setSelectedCropCycleId(e.target.value)}
                >
                  {activeCrops.length > 0 ? (
                    activeCrops.map(c => <option key={c.id} value={c.id}>{c.crop_name} {c.field_name ? `(${c.field_name})` : ''}</option>)
                  ) : (
                    uniqueCrops.length > 0 
                      ? uniqueCrops.map(c => <option key={c} value={c}>{c}</option>)
                      : <option value="">{t("No active crops found")}</option>
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Current Stage")}</span>
                <select 
                  className="farm-input w-full appearance-none"
                  value={selectedGrowthStage}
                  onChange={e => setSelectedGrowthStage(e.target.value)}
                >
                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t("Add Notes")}</span>
              <textarea 
                className="farm-input w-full min-h-32" 
                placeholder={t("Describe the growth condition...")} 
                value={stageNotes}
                onChange={e => setStageNotes(e.target.value)}
              />
            </label>

            <label className="block cursor-pointer">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t("Upload Images")}</span>
              <div className="grid place-items-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-8 text-center hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden">
                {stageImagePreview ? (
                  <img src={stageImagePreview} alt="Preview" className="max-h-48 object-contain rounded-lg" />
                ) : (
                  <>
                    <FiUploadCloud className="text-4xl text-emerald-400" />
                    <p className="mt-4 text-sm text-slate-300">{t("Drag and drop images here")}</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setStageImagePreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                />
              </div>
            </label>

            <Button type="submit" className="w-full sm:w-auto" disabled={!selectedCropCycleId}>{t("Update Progress")}</Button>
          </form>
        </Card>
      )}

      {activeTab === 'activities' && (
        <Card title={t("Record Daily Activity")} subtitle={t("Log irrigation, fertilizing, and other field tasks")}>
           <form className="space-y-6 mt-4" onSubmit={handleActivitySubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Activity Type (Today's Tasks)")}</span>
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
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Crop / Field")}</span>
                <input 
                  type="text" 
                  readOnly 
                  value={selectedTask?.crop_name || t('N/A')}
                  className="farm-input w-full bg-white/5 cursor-not-allowed text-white/50" 
                  placeholder={t("Crop will auto-fill from task")}
                />
              </label>
            </div>
            
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t("Date")}</span>
              <input 
                type="date" 
                className="farm-input w-full" 
                value={activityDate}
                onChange={e => setActivityDate(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t("Manager's Instructions")}</span>
              <textarea 
                className="farm-input w-full min-h-24 bg-white/5 cursor-not-allowed text-white/50" 
                placeholder={t("Details from manager...")} 
                readOnly
                value={selectedTask?.description || t('No specific instructions provided.')}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t("Farmer's Notes")}</span>
              <textarea 
                className="farm-input w-full min-h-24" 
                placeholder={t("Describe what you actually did...")} 
                value={activityNotes}
                onChange={e => setActivityNotes(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/80">{t("Upload Image of Work")}</span>
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

            <Button type="submit" className="w-full sm:w-auto" disabled={!selectedTaskId}>{t("Save Activity")}</Button>
          </form>
        </Card>
      )}

      {activeTab === 'disease' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title={t("Report Disease")} subtitle={t("Upload leaf images for AI analysis")}>
            <form onSubmit={handleDiseaseSubmit} className="space-y-6 mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Select Field")}</span>
                  <select 
                    className="farm-input w-full appearance-none"
                    value={selectedDiseaseField}
                    onChange={e => setSelectedDiseaseField(e.target.value)}
                  >
                    <option value="">{t("Select a field")}</option>
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.field_name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Select Crop")}</span>
                  <select 
                    className="farm-input w-full appearance-none"
                    value={selectedDiseaseCrop}
                    onChange={e => setSelectedDiseaseCrop(e.target.value)}
                    disabled={!selectedDiseaseField}
                  >
                    <option value="">{t("Select a crop")}</option>
                    {diseaseCrops.map(c => (
                      <option key={c.id} value={c.id}>{c.crop_name}</option>
                    ))}
                  </select>
                </label>
              </div>
              
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Problem Title")}</span>
                <input 
                  type="text" 
                  className="farm-input w-full" 
                  placeholder={t("e.g. Yellowing spots on leaves")} 
                  value={diseaseTitle}
                  onChange={e => setDiseaseTitle(e.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Problem Description")}</span>
                <textarea 
                  className="farm-input w-full min-h-24" 
                  placeholder={t("Provide more details...")} 
                  value={diseaseDescription}
                  onChange={e => setDiseaseDescription(e.target.value)}
                  required
                />
              </label>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Severity Level")}</span>
                  <select 
                    className="farm-input w-full appearance-none"
                    value={diseaseSeverity}
                    onChange={e => setDiseaseSeverity(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Affected Plants (Optional)")}</span>
                  <input 
                    type="number" 
                    className="farm-input w-full" 
                    placeholder="e.g. 15" 
                    value={affectedPlants}
                    onChange={e => setAffectedPlants(e.target.value)}
                  />
                </label>
              </div>

              <label className="block cursor-pointer">
                <span className="mb-2 block text-sm font-semibold text-white/80">{t("Upload Images (Max 6)")}</span>
                <div className="grid place-items-center rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 p-10 text-center hover:bg-emerald-500/20 transition-colors relative overflow-hidden">
                  {diseaseImagePreview ? (
                    <img src={diseaseImagePreview} alt="Leaf Preview" className="max-h-64 object-contain rounded-lg" />
                  ) : (
                    <>
                      <FiUploadCloud className="text-6xl text-emerald-500" />
                      <p className="mt-4 text-lg font-bold text-white">{t("Upload leaf photo")}</p>
                      <p className="mt-2 text-sm text-slate-400">{t("Supported formats: JPG, PNG")}</p>
                      <Button type="button" className="mt-6 pointer-events-none">{t("Choose File")}</Button>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setDiseaseImagePreview(URL.createObjectURL(e.target.files[0]));
                        setDiseaseImage(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </label>

              <Button type="submit" className="w-full">{t("Submit Disease Report")}</Button>
            </form>
          </Card>
          
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">{t("Disease Reports History")}</h3>
            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
              {pastReports.length === 0 ? (
                <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-slate-400">{t("No past disease reports found.")}</p>
                </div>
              ) : (
                pastReports.map(report => (
                  <div key={report.id} className="bg-slate-900/80 border border-white/10 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-semibold">{report.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-semibold
                        ${report.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                          report.status === 'Under Review' ? 'bg-amber-500/20 text-amber-400' :
                          report.status === 'Treatment Saved' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }
                      `}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{report.crop_name} | {report.field_name}</p>
                    <p className="text-sm text-slate-300 line-clamp-2 mb-3">{report.description}</p>
                    {report.manager_notes && (
                      <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-lg mb-2">
                        <p className="text-xs text-emerald-400 font-semibold mb-1">Manager Feedback & AI Results:</p>
                        <p className="text-sm text-slate-300 whitespace-pre-line">{report.manager_notes}</p>
                      </div>
                    )}
                    <div className="text-xs text-slate-500 text-right">
                      {new Date(report.reported_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
