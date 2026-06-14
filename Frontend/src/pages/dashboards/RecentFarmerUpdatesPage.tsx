import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';

export default function RecentFarmerUpdatesPage() {
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        const headers = { Authorization: `Bearer ${token}` };

        const updatesRes = await fetch('http://localhost:5000/api/tasks/updates/recent', { headers });

        if (updatesRes.ok) {
          const updatesData = await updatesRes.json();
          setRecentUpdates(updatesData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow="Farm Monitoring"
        title="Farmer Updates"
        description="View latest completed task notes and images from the field."
        tone="light"
      />

      <Card title="Recent Farmer Updates" subtitle="Latest completed task notes and images from the field">
        {loading ? (
          <div className="text-center text-slate-500 py-8">Loading updates...</div>
        ) : recentUpdates.length === 0 ? (
          <div className="text-center text-slate-500 py-8">No recent updates.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentUpdates.map((update: any) => (
              <div key={update.id} className="border border-white/10 bg-slate-900/40 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-emerald-400 font-bold truncate pr-2" title={update.task_title}>{update.task_title}</h4>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(update.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-300 font-medium mb-1"><span className="text-slate-500">Farmer:</span> {update.farmer_name}</p>
                  <p className="text-sm text-white/80 line-clamp-3 mb-4">{update.notes || 'No additional notes provided.'}</p>
                </div>
                {update.image_url && (
                  <div className="mt-2 h-32 rounded-xl overflow-hidden border border-white/10 relative group">
                    <img 
                      src={`http://localhost:5000${update.image_url}`} 
                      alt="Task update" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
