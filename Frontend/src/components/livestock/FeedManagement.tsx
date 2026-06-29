import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';

interface FeedRequirement {
  id: string;
  animalType: string;
  breedOrVariety: string;
  feedType: string;
  dailyFeedAmount: string;
  dailyWaterRequirement: string;
  unit: string;
  isDefault: boolean;
}

interface FeedSchedule {
  id: string;
  livestockId: string;
  animalTag?: string;
  feedType: string;
  feedAmount: string;
  waterRequirement: string;
  scheduledTime: string;
  status: string;
}

interface Animal {
  id: string;
  tag_code: string;
  animal_type: string;
}

export function FeedManagement() {
  const [requirements, setRequirements] = useState<FeedRequirement[]>([]);
  const [schedules, setSchedules] = useState<FeedSchedule[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqForm, setReqForm] = useState<Partial<FeedRequirement>>({});
  
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<Partial<FeedSchedule>>({
    status: 'Planned'
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [reqRes, schedRes, animRes] = await Promise.all([
        fetch('/api/livestock/feed-requirements', { headers }),
        fetch('/api/livestock/feed-schedules', { headers }),
        fetch('/api/livestock', { headers })
      ]);

      if (reqRes.ok) setRequirements(await reqRes.json());
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (animRes.ok) setAnimals(await animRes.json());
    } catch (error) {
      console.error('Failed to fetch feed data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = reqForm.id 
        ? `/api/livestock/feed-requirements/${reqForm.id}`
        : '/api/livestock/feed-requirements';
      
      const res = await fetch(url, {
        method: reqForm.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqForm)
      });
      
      if (res.ok) {
        setShowReqForm(false);
        setReqForm({});
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save requirement', err);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/livestock/feed-schedules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleForm)
      });
      
      if (res.ok) {
        setShowScheduleForm(false);
        setScheduleForm({ status: 'Planned' });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save schedule', err);
    }
  };

  const updateScheduleStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/livestock/feed-schedules/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  if (loading) return <div className="py-8 text-center text-slate-500">Loading feed data...</div>;

  return (
    <div className="space-y-8">
      {/* Feed Requirements */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Feeding Requirements</h2>
          <button 
            onClick={() => { setReqForm({}); setShowReqForm(true); }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Add Requirement
          </button>
        </div>
        
        {showReqForm && (
          <Card className="mb-6 p-4">
            <h3 className="mb-4 font-semibold">{reqForm.id ? 'Edit' : 'New'} Requirement</h3>
            <form onSubmit={handleSaveRequirement} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Animal Type</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reqForm.animalType || ''} onChange={e => setReqForm({...reqForm, animalType: e.target.value})} placeholder="e.g. Cow, Hen" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Breed / Variety</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reqForm.breedOrVariety || ''} onChange={e => setReqForm({...reqForm, breedOrVariety: e.target.value})} placeholder="e.g. Broiler, Layer" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Feed Type</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reqForm.feedType || ''} onChange={e => setReqForm({...reqForm, feedType: e.target.value})} placeholder="e.g. Broiler feed" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Daily Feed Amount</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reqForm.dailyFeedAmount || ''} onChange={e => setReqForm({...reqForm, dailyFeedAmount: e.target.value})} placeholder="e.g. 35 kg/day" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Daily Water Requirement</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reqForm.dailyWaterRequirement || ''} onChange={e => setReqForm({...reqForm, dailyWaterRequirement: e.target.value})} placeholder="e.g. 15 liters/day" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Unit</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reqForm.unit || 'kg/day'} onChange={e => setReqForm({...reqForm, unit: e.target.value})} />
              </div>
              <div className="col-span-full flex gap-3">
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Save</button>
                <button type="button" onClick={() => setShowReqForm(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700">Cancel</button>
              </div>
            </form>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {requirements.map(req => (
            <Card key={req.id} className="flex flex-col justify-between p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-slate-800">{req.animalType} - {req.breedOrVariety}</span>
                  {req.isDefault && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Default</span>}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium text-slate-900">Feed:</span> {req.feedType}</p>
                  <p><span className="font-medium text-slate-900">Amount:</span> {req.dailyFeedAmount}</p>
                  <p><span className="font-medium text-slate-900">Water:</span> {req.dailyWaterRequirement}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => { setReqForm(req); setShowReqForm(true); }} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Edit</button>
              </div>
            </Card>
          ))}
          {requirements.length === 0 && <p className="text-sm text-slate-500">No feed requirements found.</p>}
        </div>
      </div>

      {/* Feeding Schedules */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Feeding Schedules</h2>
          <button 
            onClick={() => { setScheduleForm({ status: 'Planned' }); setShowScheduleForm(true); }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Create Schedule
          </button>
        </div>

        {showScheduleForm && (
          <Card className="mb-6 p-4">
            <h3 className="mb-4 font-semibold">New Feeding Schedule</h3>
            <form onSubmit={handleSaveSchedule} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Select Animal</label>
                <select required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={scheduleForm.livestockId || ''} onChange={e => setScheduleForm({...scheduleForm, livestockId: e.target.value})}>
                  <option value="">Select an animal</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>{a.tag_code} ({a.animal_type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Scheduled Time</label>
                <input required type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={scheduleForm.scheduledTime || ''} onChange={e => setScheduleForm({...scheduleForm, scheduledTime: e.target.value})} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Feed Type</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={scheduleForm.feedType || ''} onChange={e => setScheduleForm({...scheduleForm, feedType: e.target.value})} placeholder="e.g. Mixed Grain" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Feed Amount</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={scheduleForm.feedAmount || ''} onChange={e => setScheduleForm({...scheduleForm, feedAmount: e.target.value})} placeholder="e.g. 5 kg" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Water Requirement</label>
                <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={scheduleForm.waterRequirement || ''} onChange={e => setScheduleForm({...scheduleForm, waterRequirement: e.target.value})} placeholder="e.g. 2 liters" />
              </div>
              <div className="col-span-full flex gap-3">
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Save Schedule</button>
                <button type="button" onClick={() => setShowScheduleForm(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700">Cancel</button>
              </div>
            </form>
          </Card>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Feed & Amount</th>
                <th className="px-4 py-3 font-medium">Water</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map(schedule => (
                <tr key={schedule.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{schedule.animalTag || 'Unknown'}</td>
                  <td className="px-4 py-3">{schedule.scheduledTime}</td>
                  <td className="px-4 py-3">{schedule.feedType} - {schedule.feedAmount}</td>
                  <td className="px-4 py-3">{schedule.waterRequirement}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      schedule.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {schedule.status === 'Planned' && (
                      <button 
                        onClick={() => updateScheduleStatus(schedule.id, 'Completed')}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Mark Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No schedules found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
