import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiSearch } from 'react-icons/fi';

export default function FarmerLivestockPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [livestock, setLivestock] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchGroups();
      await fetchLivestock();
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow="Farm Operations"
        title="Livestock Dashboard"
        description="View animal health, feed schedules, and pen allocations."
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
        <Card title="Livestock List" subtitle="View all animals across pens">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by species or pen..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
              />
            </div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/60">
                 {loading ? (
                   <tr><td colSpan={8} className="px-6 py-4 text-center text-slate-500">Loading livestock...</td></tr>
                 ) : livestock.length === 0 ? (
                   <tr><td colSpan={8} className="px-6 py-4 text-center text-slate-500">No livestock found.</td></tr>
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
