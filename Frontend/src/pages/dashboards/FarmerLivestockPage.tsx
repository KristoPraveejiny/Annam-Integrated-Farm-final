import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiSearch } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { deleteFeedRequirement, getFeedRequirements, type FeedRequirement } from '../../api/livestock';
import { createLivestockHealthEvent, getLivestockHealthEvents, type LivestockHealthEvent } from '../../api/livestockHealth';

export default function FarmerLivestockPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [livestock, setLivestock] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [feedConfigs, setFeedConfigs] = useState<FeedRequirement[]>([]);
  const [feedSchedules, setFeedSchedules] = useState<any[]>([]);
  const [healthEvents, setHealthEvents] = useState<LivestockHealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  const [healthImage, setHealthImage] = useState<File | null>(null);

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

  const fetchGroups = async () => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') && tokenRaw.endsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      if (!token) {
        console.warn('No auth token found, using fallback groups');
        setGroups([
          { id: 'default-cow', group_code: 'COW', species: 'Cattle' },
          { id: 'default-hen', group_code: 'HEN', species: 'Poultry' },
          { id: 'default-duck', group_code: 'DUCK', species: 'Poultry' }
        ]);
        return;
      }
      const res = await fetch('/api/livestock/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      } else {
        console.error('Failed to fetch groups, status:', res.status);
        setGroups([
          { id: 'default-cow', group_code: 'COW', species: 'Cattle' },
          { id: 'default-hen', group_code: 'HEN', species: 'Poultry' },
          { id: 'default-duck', group_code: 'DUCK', species: 'Poultry' }
        ]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
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

  const fetchFeedSchedules = async () => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      const res = await fetch('/api/livestock/feed-schedules', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFeedSchedules(await res.json());
    } catch (error) {
      console.error('Failed to fetch schedules', error);
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchGroups();
      await fetchLivestock();
      await fetchFeedConfigs();
      await fetchFeedSchedules();
      await fetchHealthEvents();
      setLoading(false);
    };
    loadData();
  }, []);

  const handleHealthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(healthForm).forEach(([key, value]) => {
        formData.append(key, value);
      });
      if (healthImage) {
        formData.append('image', healthImage);
      }
      
      const saved = await createLivestockHealthEvent(formData);
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
      setHealthImage(null);
    } catch (error) {
      console.error('Failed to save livestock health event:', error);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t("Farm Operations")}
        title={t("Livestock Dashboard")}
        description={t("View animal health, feed schedules, and pen allocations.")}
        tone="light"
      />

      {/* Tabs */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['overview', 'list', 'feed', 'health'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'
            }`}
          >
            {t(tab === 'overview' ? 'Overview' : tab.charAt(0).toUpperCase() + tab.slice(1))}
          </button>
        ))}
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-6">
          <Card title={t("Feed Requirements")} subtitle={t("View feeding requirements added by Farm Manager")}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {feedConfigs.map((config) => (
                <div key={config.id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">{config.animalType}</p>
                      <h4 className="mt-2 text-xl font-bold text-white">{config.breedOrVariety}</h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="rounded-2xl bg-white/5 px-4 py-3">Feed: <span className="font-semibold text-white">{config.dailyFeedAmount}</span></div>
                    <div className="rounded-2xl bg-white/5 px-4 py-3">Water: <span className="font-semibold text-white">{config.dailyWaterRequirement}</span></div>
                    <div className="rounded-2xl bg-white/5 px-4 py-3">Type: <span className="font-semibold text-white">{config.feedType}</span></div>
                  </div>
                </div>
              ))}
              {feedConfigs.length === 0 && <p className="text-sm text-slate-400">No feed requirements found.</p>}
            </div>
          </Card>

          <Card title={t("Feeding Schedule")} subtitle={t("Planned feed deliveries")}>
            <div className="space-y-3">
              {feedSchedules.length === 0 ? (
                <p className="text-sm text-slate-400">{t("No feeding schedules yet.")}</p>
              ) : (
                feedSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{schedule.animalLabel || schedule.animal_id}</p>
                        <p className="mt-1 text-xs text-slate-400">{schedule.feedType || schedule.feed_type}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{schedule.time}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                      <span>{t("Feed")}: {schedule.amount}</span>
                      <span>{t("Water")}: {schedule.water}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card title={t("Add Health Record")} subtitle={t("Record symptoms and upload images")}>
            <form onSubmit={handleHealthSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">{t("Animal")}</label>
                <select className="farm-input" value={healthForm.livestockId} onChange={(e) => setHealthForm((prev) => ({ ...prev, livestockId: e.target.value }))} required>
                  <option value="">{t("Select animal")}</option>
                  {livestock.map((animal) => (
                    <option key={animal.dbId || animal.id} value={animal.dbId || animal.id}>{animal.id} • {animal.pen}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">{t("Health issue")}</label>
                <textarea rows={3} className="farm-input resize-y" value={healthForm.healthIssue} onChange={(e) => setHealthForm((prev) => ({ ...prev, healthIssue: e.target.value }))} placeholder={t("e.g. Fever")} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input className="farm-input" value={healthForm.symptoms} onChange={(e) => setHealthForm((prev) => ({ ...prev, symptoms: e.target.value }))} placeholder={t("Symptoms")} />
                <input className="farm-input" value={healthForm.vaccinationDetails} onChange={(e) => setHealthForm((prev) => ({ ...prev, vaccinationDetails: e.target.value }))} placeholder={t("Vaccination details")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input type="date" className="farm-input" value={healthForm.eventDate} onChange={(e) => setHealthForm((prev) => ({ ...prev, eventDate: e.target.value }))} />
                <select className="farm-input" value={healthForm.status} onChange={(e) => setHealthForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option>{t("Healthy")}</option>
                  <option>{t("Under Treatment")}</option>
                  <option>{t("Recovered")}</option>
                  <option>{t("Sick")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">{t("Image (Optional)")}</label>
                <input type="file" accept="image/*" onChange={(e) => setHealthImage(e.target.files?.[0] || null)} className="w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20" />
              </div>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 py-3 font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-lime-300">
                {t("Save Health Record")}
              </button>
            </form>
          </Card>
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
                      <div className="mt-3">
                        {/* @ts-ignore */}
                        <img src={record.imageUrl} alt="Health condition" className="h-32 w-full object-cover rounded-xl" />
                      </div>
                    )}
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                      <span>{t("Symptoms")}: {record.symptoms || '-'}</span>
                      <span>{t("Diagnosis")}: {record.diagnosis || '-'}</span>
                      <span>{t("Treatment")}: {record.treatment || '-'}</span>
                      <span>{t("Vaccination")}: {record.vaccinationDetails || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
      {activeTab === 'overview' && (
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
      )}

      {activeTab === 'list' && (
        <Card title={t("Livestock List")} subtitle={t("View all animals across pens")}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search by species or pen...")}
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
              />
            </div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/60">
                 {loading ? (
                   <tr><td colSpan={8} className="px-6 py-4 text-center text-slate-500">{t("Loading livestock...")}</td></tr>
                 ) : livestock.length === 0 ? (
                   <tr><td colSpan={8} className="px-6 py-4 text-center text-slate-500">{t("No livestock found.")}</td></tr>
                 ) : (
                  livestock.map(l => (
                    <tr key={l.dbId || l.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-emerald-400">{l.id}</td>
                       <td className="px-6 py-4">
                         <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">{l.pen}</span>
                       </td>
                       <td className="px-6 py-4">{l.dob}</td>
                       <td className="px-6 py-4">{t(l.sex)}</td>
                       <td className="px-6 py-4">{l.weight}</td>
                       <td className="px-6 py-4">{l.acquisitionDate ? new Date(l.acquisitionDate).toLocaleDateString() : t('N/A')}</td>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
