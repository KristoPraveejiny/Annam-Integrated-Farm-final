import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiDroplet, FiMapPin, FiEdit2, FiTrash2, FiSearch, FiPlus, FiCheckCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../utils/apiFetch';

export default function FarmManagerCropsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [newCrop, setNewCrop] = useState<any>({ 
    crop_name: '', variety: '', block_id: '', planting_date: '', expected_harvest_date: '', 
    season: '', expected_yield: '', yield_unit: 'kg', notes: '' 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<any | null>(null);
  const [editingCropId, setEditingCropId] = useState<string | null>(null);

  const growthStageMap: Record<string, string[]> = {
    papaya: ['Seed', 'Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvest'],
    paddy: ['Seed', 'Nursery', 'Transplant', 'Tillering', 'Flowering', 'Maturity', 'Harvest'],
    default: ['Seed', 'Germination', 'Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvest'],
  };

  const getTimelineStages = (cropName: string) => {
    const key = cropName?.toLowerCase().includes('papaya')
      ? 'papaya'
      : cropName?.toLowerCase().includes('paddy') || cropName?.toLowerCase().includes('rice')
      ? 'paddy'
      : 'default';
    return growthStageMap[key];
  };

  const getGrowthProgress = (crop: any) => {
    if (typeof crop.growth_percentage === 'number') return crop.growth_percentage;
    const planting = crop.planting_date ? new Date(crop.planting_date).getTime() : null;
    const harvest = crop.expected_harvest_date ? new Date(crop.expected_harvest_date).getTime() : null;
    if (!planting || !harvest || harvest <= planting) return 0;
    const now = Date.now();
    const progress = ((now - planting) / (harvest - planting)) * 100;
    return Math.max(0, Math.min(100, Math.round(progress)));
  };

  const getStage = (crop: any) => {
    if (crop.current_stage) return crop.current_stage;
    if (crop.status === 'Harvesting') return 'Harvest';
    if (crop.status === 'Growing') return 'Vegetative';
    if (crop.status === 'Planned') return 'Seed';
    return 'Seed';
  };

  const filteredCrops = crops.filter(c => {
    const fieldName = fields.find(f => String(f.id) === String(c.field_id))?.field_name || '';
    const cropMatch = cropFilter === 'all' || c.crop_name === cropFilter;
    const fieldMatch = fieldFilter === 'all' || String(c.field_id) === String(fieldFilter);
    return cropMatch && fieldMatch && (
      c.crop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      fieldName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const tokenStr = token && token.startsWith('"') ? token.slice(1, -1) : token;
      const headers: Record<string, string> = tokenStr ? { 'Authorization': `Bearer ${tokenStr}` } : {};

      // Fetch crops and blocks
      try {
        const cropsRes = await apiFetch('/api/crops');
        if (!cropsRes.ok) throw new Error('API failed');
        const cropsData = await cropsRes.json();
        setCrops(cropsData);
        
        const blocksRes = await apiFetch('/api/fields/farm/default');
        if (!blocksRes.ok) throw new Error('API failed');
        const blocksData = await blocksRes.json();
        setFields(blocksData);

        const updatesRes = await apiFetch('/api/crop-observations/recent');
        if (updatesRes.ok) {
          setRecentUpdates(await updatesRes.json());
        }
      } catch (err) {
        console.warn('API not available, using mock data for crops and fields');
        // Mock data for UI testing
        setFields([
          { id: '1', field_name: 'North Field A', area: '5 Acres', soil: 'Loam', irrigation: 'Drip', location: 'Sector 1' },
          { id: '2', field_name: 'South Field B', area: '12 Acres', soil: 'Clay', irrigation: 'Sprinkler', location: 'Sector 2' },
          { id: '3', field_name: 'East Greenhouse', area: '2 Acres', soil: 'Potting Mix', irrigation: 'Automated', location: 'Sector 3' }
        ]);
        setCrops([
          { id: 'CRP-101', crop_name: 'Tomato', variety: 'Roma', block_id: '1', planting_date: '2023-04-15', status: 'Growing' },
          { id: 'CRP-102', crop_name: 'Corn', variety: 'Sweet Corn', block_id: '2', planting_date: '2023-05-01', status: 'Harvesting' }
        ]);
        setRecentUpdates([
          { id: 'obs-1', crop_name: 'Tomato', farmer_name: 'Worker A', notes: 'Height increased', observed_at: new Date().toISOString(), growth_stage: 'Vegetative' },
        ]);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCrop((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleEditCrop = (crop: any) => {
    setEditingCropId(crop.id);
    setNewCrop({
      crop_name: crop.crop_name || '',
      variety: crop.variety || '',
      field_id: crop.field_id || '',
      planting_date: crop.planting_date ? crop.planting_date.split('T')[0] : '',
      expected_harvest_date: crop.expected_harvest_date ? crop.expected_harvest_date.split('T')[0] : '',
      season: crop.season || '',
      expected_yield: crop.expected_yield || '',
      yield_unit: crop.yield_unit || 'kg',
      notes: crop.notes || ''
    });
    setShowCropModal(true);
  };

  const handleDeleteCrop = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await apiFetch(`/api/crops/${id}`, { method: 'DELETE' });
      setCrops((prev) => prev.filter(c => c.id !== id));
    } catch (err) {
      console.warn('API delete failed, using mock delete', err);
      setCrops((prev) => prev.filter(c => c.id !== id));
    }
  };

  const handleSaveCrop = async () => {
    const mockSave = () => {
      if (editingCropId) {
        setCrops(prev => prev.map(c => c.id === editingCropId ? { ...c, ...newCrop } : c));
      } else {
        const created = { 
          id: `CRP-${Math.floor(Math.random() * 10000)}`, 
          ...newCrop,
          status: 'Growing'
        };
        setCrops((prev) => [...prev, created]);
      }
      setShowCropModal(false);
      setNewCrop({ crop_name: '', variety: '', field_id: '', planting_date: '', expected_harvest_date: '', season: '', expected_yield: '', yield_unit: 'kg', notes: '' });
      setEditingCropId(null);
    };

    try {
      const token = localStorage.getItem('token');
      const method = editingCropId ? 'PUT' : 'POST';
      const url = editingCropId ? `/api/crops/${editingCropId}` : '/api/crops';
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCrop),
      });
      if (response.ok) {
        const saved = await response.json();
        if (editingCropId) {
          setCrops((prev) => prev.map(c => c.id === editingCropId ? saved : c));
        } else {
          setCrops((prev) => [...prev, saved]);
        }
        setShowCropModal(false);
        setNewCrop({ crop_name: '', variety: '', field_id: '', planting_date: '', expected_harvest_date: '', season: '', expected_yield: '', yield_unit: 'kg', notes: '' });
        setEditingCropId(null);
      } else {
        console.error('Failed to save crop via API, using mockup.');
        mockSave();
      }
    } catch (err) {
      console.error('Error saving crop', err);
      mockSave();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading eyebrow={t("Crop Management")} title={t("Crops & Fields")} description={t("Manage your crop lifecycle, fields, and growth monitoring.")} tone="light" />
      {/* Tabs */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['dashboard', 'crops', 'growth'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'
            }`}
          >
            {tab === 'dashboard' ? t('Overview') : t(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title={t("Total Crops")} subtitle={t("All registered crops")}>
            <p className="text-5xl font-black text-emerald-400 mt-2">{crops.length}</p>
          </Card>
          <Card title={t("Active Fields")} subtitle={t("Currently in use")}>
            <p className="text-5xl font-black text-lime-400 mt-2">{fields.length}</p>
          </Card>
          <Card title={t("Disease Alerts")} subtitle={t("Requires attention")}>
            <p className="text-5xl font-black text-amber-500 mt-2">2</p>
          </Card>
        </div>
      )}

      {activeTab === 'crops' && (
        <Card title={t("Crop List")} subtitle={t("Manage all crops across fields")}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search crops by name or field...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
              />
            </div>
            <Button onClick={() => setShowCropModal(true)} className="flex items-center gap-2 whitespace-nowrap">
              <FiPlus className="text-lg" /> {t("Register Crop")}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-white font-semibold">
                <tr>
                  <th className="px-6 py-4">{t("ID")}</th>
                  <th className="px-6 py-4">{t("Crop Name")}</th>
                  <th className="px-6 py-4">{t("Variety")}</th>
                  <th className="px-6 py-4">{t("Field")}</th>
                  <th className="px-6 py-4">{t("Planting Date")}</th>
                  <th className="px-6 py-4">{t("Status")}</th>
                  <th className="px-6 py-4 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/60">
                {filteredCrops.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-emerald-400">{c.id}</td>
                    <td className="px-6 py-4 font-bold text-white">{c.crop_name}</td>
                    <td className="px-6 py-4">{c.variety}</td>
                    <td className="px-6 py-4 font-medium">
                      <span className="flex items-center gap-2">
                        <FiMapPin className="text-slate-400" /> {fields.find(f => String(f.id) === String(c.field_id))?.field_name || ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">{c.planting_date ? new Date(c.planting_date).toLocaleDateString() : ''}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          c.status === 'Growing'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-4">
                      <button onClick={() => handleEditCrop(c)} className="text-blue-400 hover:text-blue-300 transition-colors" title="Edit">
                        <FiEdit2 className="text-lg" />
                      </button>
                      <button onClick={() => handleDeleteCrop(c.id)} className="text-rose-400 hover:text-rose-300 transition-colors" title="Delete">
                        <FiTrash2 className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'growth' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-4">
            <Card title={t("Active Crop Cycles")} subtitle={t("Currently growing crops")}>
              <p className="mt-2 text-5xl font-black text-emerald-400">{crops.filter((crop) => ['planned', 'seeded', 'growing', 'harvesting'].includes(String(crop.status || '').toLowerCase())).length}</p>
            </Card>
            <Card title={t("Ready for Harvest")} subtitle={t("Near completion")}>
              <p className="mt-2 text-5xl font-black text-lime-400">{crops.filter((crop) => getGrowthProgress(crop) >= 85).length}</p>
            </Card>
            <Card title={t("Delayed Growth")} subtitle={t("Needs attention")}>
              <p className="mt-2 text-5xl font-black text-amber-400">{crops.filter((crop) => getGrowthProgress(crop) < 45 && ['growing', 'seeded'].includes(String(crop.status || '').toLowerCase())).length}</p>
            </Card>
            <Card title={t("Average Growth Progress %")} subtitle={t("Across active crop cycles")}>
              <p className="mt-2 text-5xl font-black text-sky-400">
                {crops.length ? Math.round(crops.reduce((total, crop) => total + getGrowthProgress(crop), 0) / crops.length) : 0}%
              </p>
            </Card>
          </div>

          <Card title={t("Crop Growth Table")} subtitle={t("Display all active crop cycles")}>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-4 top-3.5 text-slate-400" />
                <input className="w-full rounded-2xl border border-white/10 bg-slate-900/50 py-3 pl-11 pr-4 text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("Search")} />
              </div>
              <select className="farm-input" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
                <option value="all">{t("All Crops")}</option>
                {[...new Set(crops.map((crop) => crop.crop_name).filter(Boolean))].map((cropName) => <option key={cropName} value={cropName}>{cropName}</option>)}
              </select>
              <select className="farm-input" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
                <option value="all">{t("All Fields")}</option>
                {fields.map((field) => <option key={field.id} value={field.id}>{field.field_name}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/90 text-white">
                  <tr>
                    <th className="px-6 py-4">{t("Field Name")}</th>
                    <th className="px-6 py-4">{t("Crop Name")}</th>
                    <th className="px-6 py-4">{t("Planting Date")}</th>
                    <th className="px-6 py-4">{t("Current Growth Stage")}</th>
                    <th className="px-6 py-4">{t("Growth Progress %")}</th>
                    <th className="px-6 py-4">{t("Expected Harvest Date")}</th>
                    <th className="px-6 py-4">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/60">
                  {filteredCrops.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-6 text-center text-slate-400">{t("No crops found")}</td></tr>
                  ) : filteredCrops.map((crop) => {
                    const progress = getGrowthProgress(crop);
                    const fieldName = fields.find((field) => String(field.id) === String(crop.field_id))?.field_name || '-';
                    const stages = getTimelineStages(crop.crop_name);
                    return (
                      <tr key={crop.id} onClick={() => { setSelectedCrop(crop); setShowGrowthModal(true); }} className="cursor-pointer hover:bg-white/5">
                        <td className="px-6 py-4 text-slate-200">{fieldName}</td>
                        <td className="px-6 py-4 font-semibold text-white">{crop.crop_name}</td>
                        <td className="px-6 py-4 text-slate-300">{crop.planting_date ? new Date(crop.planting_date).toLocaleDateString() : '-'}</td>
                        <td className="px-6 py-4 text-slate-300">{t(getStage(crop))}</td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="h-2 rounded-full bg-white/10">
                              <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-300">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{crop.expected_harvest_date ? new Date(crop.expected_harvest_date).toLocaleDateString() : '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            progress >= 75 ? 'bg-emerald-500/10 text-emerald-300' : progress >= 45 ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'
                          }`}>
                            {progress >= 75 ? t('Healthy') : progress >= 45 ? t('On Track') : t('Alert')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card title={t("Growth Alerts")} subtitle={t("Based on crop data and task records")}>
              <div className="space-y-3">
                {crops.filter((crop) => getGrowthProgress(crop) < 45).length === 0 ? (
                  <p className="text-sm text-slate-400">{t("No alerts right now.")}</p>
                ) : crops.filter((crop) => getGrowthProgress(crop) < 45).map((crop) => (
                  <div key={crop.id} className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <p className="font-semibold">{crop.crop_name}</p>
                    <p className="mt-1 text-amber-50/80">{t("Growth delayed or needs review")}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title={t("Recent Crop Updates")} subtitle={t("Worker updates from existing observations")}>
              <div className="space-y-3">
                {recentUpdates.length === 0 ? (
                  <p className="text-sm text-slate-400">{t("No recent updates found.")}</p>
                ) : recentUpdates.map((update) => (
                  <div key={update.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{update.crop_name}</p>
                      <span className="text-xs text-slate-400">{update.observed_at ? new Date(update.observed_at).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{update.notes || update.message || '-'}</p>
                    <p className="mt-2 text-xs text-slate-500">{update.farmer_name || update.updated_by || '-'}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {showGrowthModal && selectedCrop ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedCrop.crop_name}</h3>
                <p className="mt-1 text-sm text-slate-400">{fields.find((field) => String(field.id) === String(selectedCrop.field_id))?.field_name || '-'}</p>
              </div>
              <Button variant="ghost" onClick={() => setShowGrowthModal(false)}>{t("Cancel")}</Button>
            </div>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                <span>{t("Growth Progress %")}</span>
                <span>{getGrowthProgress(selectedCrop)}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/10">
                <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${getGrowthProgress(selectedCrop)}%` }} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {getTimelineStages(selectedCrop.crop_name).map((stage, index) => {
                const currentIndex = Math.min(getTimelineStages(selectedCrop.crop_name).length - 1, Math.floor((getGrowthProgress(selectedCrop) / 100) * getTimelineStages(selectedCrop.crop_name).length));
                const active = index === currentIndex;
                const done = index < currentIndex;
                return (
                  <div key={stage} className={`rounded-2xl border p-4 ${active ? 'border-lime-400/40 bg-lime-400/10 text-lime-100' : done ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                    <p className="text-xs uppercase tracking-[0.2em]">{t("Stage")}</p>
                    <p className="mt-2 text-lg font-semibold">{t(stage)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">{editingCropId ? t('Edit Crop') : t('Register New Crop')}</h3>
            <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto p-1">
              <input
                name="crop_name"
                value={newCrop.crop_name}
                onChange={handleInputChange}
                placeholder={t("Crop name")}
                className="w-full bg-slate-800 text-white p-2 rounded col-span-2"
              />
              <input
                name="variety"
                value={newCrop.variety}
                onChange={handleInputChange}
                placeholder="Variety"
                className="w-full bg-slate-800 text-white p-2 rounded"
              />
              <select
                name="field_id"
                value={newCrop.field_id || ''}
                onChange={handleInputChange}
                className="w-full bg-slate-800 text-white p-2 rounded"
              >
                <option value="" disabled hidden>{t("Select Field")}</option>
                {fields.map(f => (
                  <option key={f.id} value={f.id}>{f.field_name}</option>
                ))}
              </select>
              <input
                name="planting_date"
                type="date"
                value={newCrop.planting_date}
                onChange={handleInputChange}
                className="w-full bg-slate-800 text-white p-2 rounded"
                title="Planting Date"
              />
              <input
                name="expected_harvest_date"
                type="date"
                value={newCrop.expected_harvest_date}
                onChange={handleInputChange}
                className="w-full bg-slate-800 text-white p-2 rounded"
                title={t("Expected Harvest Date")}
              />
              <input
                name="season"
                value={newCrop.season}
                onChange={handleInputChange}
                placeholder={t("Season (e.g. Summer)")}
                className="w-full bg-slate-800 text-white p-2 rounded"
              />
              <div className="flex gap-2">
                <input
                  name="expected_yield"
                  type="number"
                  value={newCrop.expected_yield}
                  onChange={handleInputChange}
                  placeholder={t("Expected Yield")}
                  className="w-full bg-slate-800 text-white p-2 rounded"
                />
                <select
                  name="yield_unit"
                  value={newCrop.yield_unit}
                  onChange={handleInputChange}
                  className="bg-slate-800 text-white p-2 rounded w-24"
                >
                  <option value="kg">kg</option>
                  <option value="tons">tons</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <textarea
                name="notes"
                value={newCrop.notes}
                onChange={handleInputChange}
                placeholder={t("Notes")}
                className="w-full bg-slate-800 text-white p-2 rounded col-span-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => { setShowCropModal(false); setEditingCropId(null); setNewCrop({ crop_name: '', variety: '', field_id: '', planting_date: '', expected_harvest_date: '', season: '', expected_yield: '', yield_unit: 'kg', notes: '' }); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleSaveCrop}>{editingCropId ? t('Update Crop') : t('Save Crop')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
