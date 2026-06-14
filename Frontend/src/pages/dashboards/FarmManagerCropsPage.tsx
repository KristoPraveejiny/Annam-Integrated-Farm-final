import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiDroplet, FiMapPin, FiEdit2, FiTrash2, FiSearch, FiPlus, FiCheckCircle } from 'react-icons/fi';

export default function FarmManagerCropsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [showCropModal, setShowCropModal] = useState(false);
  const [newCrop, setNewCrop] = useState<any>({ 
    crop_name: '', variety: '', block_id: '', planting_date: '', expected_harvest_date: '', 
    season: '', expected_yield: '', yield_unit: 'kg', notes: '' 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCropId, setEditingCropId] = useState<string | null>(null);

  const filteredCrops = crops.filter(c => {
    const fieldName = fields.find(f => String(f.id) === String(c.block_id))?.name || '';
    return c.crop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           fieldName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const tokenStr = token && token.startsWith('"') ? token.slice(1, -1) : token;
      const headers: Record<string, string> = tokenStr ? { 'Authorization': `Bearer ${tokenStr}` } : {};

      // Fetch crops and blocks
      try {
        const cropsRes = await fetch('/api/crops', { headers });
        if (!cropsRes.ok) throw new Error('API failed');
        const cropsData = await cropsRes.json();
        setCrops(cropsData);
        
        const blocksRes = await fetch('/api/blocks', { headers });
        if (!blocksRes.ok) throw new Error('API failed');
        const blocksData = await blocksRes.json();
        setFields(blocksData);
      } catch (err) {
        console.warn('API not available, using mock data for crops and fields');
        // Mock data for UI testing
        setFields([
          { id: '1', name: 'North Field A', area: '5 Acres', soil: 'Loam', irrigation: 'Drip', location: 'Sector 1' },
          { id: '2', name: 'South Field B', area: '12 Acres', soil: 'Clay', irrigation: 'Sprinkler', location: 'Sector 2' },
          { id: '3', name: 'East Greenhouse', area: '2 Acres', soil: 'Potting Mix', irrigation: 'Automated', location: 'Sector 3' }
        ]);
        setCrops([
          { id: 'CRP-101', crop_name: 'Tomato', variety: 'Roma', block_id: '1', planting_date: '2023-04-15', status: 'Growing' },
          { id: 'CRP-102', crop_name: 'Corn', variety: 'Sweet Corn', block_id: '2', planting_date: '2023-05-01', status: 'Harvesting' }
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
      block_id: crop.block_id || '',
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
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      await fetch(`/api/crops/${id}`, { method: 'DELETE', headers });
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
      setNewCrop({ crop_name: '', variety: '', block_id: '', planting_date: '', expected_harvest_date: '', season: '', expected_yield: '', yield_unit: 'kg', notes: '' });
      setEditingCropId(null);
    };

    try {
      const token = localStorage.getItem('token');
      const method = editingCropId ? 'PUT' : 'POST';
      const url = editingCropId ? `/api/crops/${editingCropId}` : '/api/crops';
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
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
        setNewCrop({ crop_name: '', variety: '', block_id: '', planting_date: '', expected_harvest_date: '', season: '', expected_yield: '', yield_unit: 'kg', notes: '' });
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
      <SectionHeading eyebrow="Crop Management" title="Crops & Fields" description="Manage your crop lifecycle, fields, and growth monitoring." tone="light" />
      {/* Tabs */}
      <div className="flex space-x-3 border-b border-white/10 pb-4 overflow-x-auto">
        {['dashboard', 'crops', 'fields', 'growth'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'
            }`}
          >
            {tab === 'dashboard' ? 'Overview' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Total Crops" subtitle="All registered crops">
            <p className="text-5xl font-black text-emerald-400 mt-2">{crops.length}</p>
          </Card>
          <Card title="Active Fields" subtitle="Currently in use">
            <p className="text-5xl font-black text-lime-400 mt-2">{fields.length}</p>
          </Card>
          <Card title="Disease Alerts" subtitle="Requires attention">
            <p className="text-5xl font-black text-amber-500 mt-2">2</p>
          </Card>
        </div>
      )}

      {activeTab === 'crops' && (
        <Card title="Crop List" subtitle="Manage all crops across fields">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search crops by name or field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
              />
            </div>
            <Button onClick={() => setShowCropModal(true)} className="flex items-center gap-2 whitespace-nowrap">
              <FiPlus className="text-lg" /> Register Crop
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-white font-semibold">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Crop Name</th>
                  <th className="px-6 py-4">Variety</th>
                  <th className="px-6 py-4">Field</th>
                  <th className="px-6 py-4">Planting Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
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
                        <FiMapPin className="text-slate-400" /> {fields.find(f => String(f.id) === String(c.block_id))?.name || c.block_id}
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

      {activeTab === 'fields' && (
        <Card title="Field Management" subtitle="Manage your land parcels and resources">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-2">
            {fields.map((f) => (
              <div
                key={f.id}
                className="border border-white/10 bg-slate-900/40 rounded-3xl p-6 hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all group shadow-lg"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-black text-white group-hover:text-emerald-300 transition-colors">
                      {f.name}
                    </h3>
                    <p className="text-sm font-bold text-emerald-500 mt-1">{f.area}</p>
                  </div>
                  <button className="text-slate-500 hover:text-blue-400 transition-colors bg-white/5 p-2 rounded-xl">
                    <FiEdit2 size={16} />
                  </button>
                </div>
                <div className="space-y-4 text-sm font-medium text-slate-300 bg-black/20 p-4 rounded-2xl border border-white/5">
                  <p className="flex justify-between"><span className="text-slate-500">Soil Type</span> <span className="text-white">{f.soil}</span></p>
                  <p className="flex justify-between"><span className="text-slate-500">Irrigation</span> <span className="text-white">{f.irrigation}</span></p>
                  <p className="flex justify-between"><span className="text-slate-500">Sector</span> <span className="text-white">{f.location}</span></p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'growth' && (
        <Card title="Crop Growth Monitoring" subtitle="Track lifecycle stages across your fields in real-time">
          <div className="space-y-8 mt-6">
            {crops.filter((c) => c.status === 'Growing').map((c) => (
              <div key={c.id} className="border border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-10">
                  <h4 className="text-xl font-black text-white">
                    {c.crop_name} <span className="text-slate-500 font-medium text-lg ml-2">({fields.find(f => String(f.id) === String(c.block_id))?.name || c.block_id})</span>
                  </h4>
                  <span className="text-sm font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">On Track</span>
                </div>
                <div className="relative flex justify-between items-center w-full px-2 sm:px-6">
                  <div className="absolute top-1/2 left-6 right-6 h-1.5 bg-slate-800 -z-10 transform -translate-y-1/2 rounded-full" />
                  <div className="absolute top-1/2 left-6 w-[60%] h-1.5 bg-gradient-to-r from-emerald-600 to-lime-400 -z-10 transform -translate-y-1/2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)]" />
                  {['Seed Sowing', 'Germination', 'Vegetative', 'Flowering', 'Harvesting'].map((stage, i) => {
                    const isCompleted = i < 2;
                    const isCurrent = i === 2;
                    return (
                      <div key={stage} className="flex flex-col items-center gap-3">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base border-4 ${
                            isCompleted
                              ? 'bg-emerald-500 text-white border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                              : isCurrent
                              ? 'bg-slate-900 text-lime-400 border-lime-500 shadow-[0_0_15px_rgba(132,204,22,0.4)]'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          } transition-all duration-300`}
                        >
                          {isCompleted ? <FiCheckCircle className="text-xl" /> : i + 1}
                        </div>
                        <span
                          className={`text-xs sm:text-sm font-bold text-center w-20 sm:w-24 ${
                            isCompleted ? 'text-emerald-400' : isCurrent ? 'text-lime-400' : 'text-slate-600'
                          }`}
                        >
                          {stage}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">{editingCropId ? 'Edit Crop' : 'Register New Crop'}</h3>
            <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto p-1">
              <input
                name="crop_name"
                value={newCrop.crop_name}
                onChange={handleInputChange}
                placeholder="Crop name"
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
                name="block_id"
                value={newCrop.block_id}
                onChange={handleInputChange}
                className="w-full bg-slate-800 text-white p-2 rounded"
              >
                <option value="" disabled hidden>Select Field</option>
                {fields.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
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
                title="Expected Harvest Date"
              />
              <input
                name="season"
                value={newCrop.season}
                onChange={handleInputChange}
                placeholder="Season (e.g. Summer)"
                className="w-full bg-slate-800 text-white p-2 rounded"
              />
              <div className="flex gap-2">
                <input
                  name="expected_yield"
                  type="number"
                  value={newCrop.expected_yield}
                  onChange={handleInputChange}
                  placeholder="Expected Yield"
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
                placeholder="Notes"
                className="w-full bg-slate-800 text-white p-2 rounded col-span-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => { setShowCropModal(false); setEditingCropId(null); setNewCrop({ crop_name: '', variety: '', block_id: '', planting_date: '', expected_harvest_date: '', season: '', expected_yield: '', yield_unit: 'kg', notes: '' }); }}>
                Cancel
              </Button>
              <Button onClick={handleSaveCrop}>{editingCropId ? 'Update Crop' : 'Save Crop'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
