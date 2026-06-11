import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiMapPin, FiHeart, FiDroplet, FiCheckCircle } from 'react-icons/fi';

export default function FarmManagerLivestockPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [livestock, setLivestock] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    const res = await fetch('http://localhost:5000/api/livestock', {
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
      console.log('Fetched token for groups:', tokenRaw);
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
      const res = await fetch('http://localhost:5000/api/livestock/groups', {
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchGroups();
      await fetchLivestock();
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
        ? `http://localhost:5000/api/livestock/${editingId}`
        : 'http://localhost:5000/api/livestock';
      
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
      } else {
        const errorData = await res.json();
        alert(errorData.error || `Failed to ${isEditing ? 'update' : 'add'} animal`);
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('An error occurred while saving.');
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
    if (!confirm('Are you sure you want to delete this animal?')) return;
    try {
      const token = localStorage.getItem('token');
      const cleanToken = token && token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token;
      const res = await fetch(`http://localhost:5000/api/livestock/${dbId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cleanToken}` }
      });

      if (res.ok) {
        fetchLivestock();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete animal');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('An error occurred while deleting.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow="Livestock Management"
        title="Livestock"
        description="Track animal health, feed schedules, and pen allocations."
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
            {tab === 'overview' ? 'Overview' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-4">
          <Card title="Total Animals" subtitle="All registered livestock">
            <p className="text-5xl font-black text-emerald-400 mt-2">{livestock.length}</p>
          </Card>
          <Card title="Sick Animals" subtitle="Needs attention">
            <p className="text-5xl font-black text-rose-500 mt-2">
              {livestock.filter(l => l.health?.toLowerCase() === 'sick').length}
            </p>
          </Card>
          <Card title="Under Treatment" subtitle="Currently receiving care">
            <p className="text-5xl font-black text-amber-500 mt-2">
              {livestock.filter(l => l.health?.toLowerCase() === 'treatment').length}
            </p>
          </Card>
          <Card title="Today's Feed Tasks" subtitle="Pending feed deliveries">
            <p className="text-5xl font-black text-lime-400 mt-2">3</p>
          </Card>
        </div>
      )}

      {activeTab === 'list' && (
        <Card title="Livestock List" subtitle="Manage all animals across pens">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by species or pen..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
              />
            </div>
            <Button onClick={() => {
              setIsEditing(false);
              setEditingId(null);
              setFormData({ tagCode: '', groupId: '', dob: '', healthStatus: 'healthy', sex: '', weight: '', acquisitionDate: '', notes: '' });
              setShowModal(true);
            }} className="flex items-center gap-2 whitespace-nowrap">
              <FiPlus className="text-lg" /> Add Animal
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-white font-semibold">
                <tr>
                  <th className="px-6 py-4">ID (Tag)</th>
                  <th className="px-6 py-4">Group/Pen</th>
                  <th className="px-6 py-4">DOB</th>
                  <th className="px-6 py-4">Sex</th>
                  <th className="px-6 py-4">Weight</th>
                  <th className="px-6 py-4">Acquisition Date</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4">Health</th>
                  <th className="px-6 py-4 text-right">Actions</th>
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
                          {l.health}
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
                          onClick={() => handleDelete(l.dbId)}
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

      {/* Add Livestock Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-white mb-6">
              {isEditing ? 'Edit Animal' : 'Add New Animal'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tag Code (ID) *</label>
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
                <label className="block text-sm font-medium text-slate-300 mb-1">Livestock Group *</label>
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
                <label className="block text-sm font-medium text-slate-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={e => setFormData({...formData, dob: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Health Status</label>
                <select
                  value={formData.healthStatus}
                  onChange={e => setFormData({...formData, healthStatus: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="healthy">Healthy</option>
                  <option value="treatment">Treatment</option>
                  <option value="sick">Sick</option>
                </select>
              </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Sex *</label>
                  <select
                    required
                    name="sex"
                    value={formData.sex || ''}
                    onChange={e => setFormData({ ...formData, sex: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled>Select sex...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Current Weight (kg)</label>
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
                  <label className="block text-sm font-medium text-slate-300 mb-1">Acquisition Date</label>
                  <input
                    type="date"
                    name="acquisitionDate"
                    value={formData.acquisitionDate || ''}
                    onChange={e => setFormData({ ...formData, acquisitionDate: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
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
                <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit">Save Animal</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
