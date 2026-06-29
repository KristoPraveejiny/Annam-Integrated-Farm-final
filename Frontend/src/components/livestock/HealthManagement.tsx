import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';

interface HealthEvent {
  id: string;
  livestockId: string;
  animalTag?: string;
  healthIssue: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  vaccinationDetails: string;
  eventDate: string;
  status: string;
}

interface Animal {
  id: string;
  tag_code: string;
  animal_type: string;
}

export function HealthManagement() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<HealthEvent>>({
    status: 'Healthy',
    eventDate: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [eventsRes, animRes] = await Promise.all([
        fetch('/api/livestock/health-events', { headers }),
        fetch('/api/livestock', { headers })
      ]);

      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (animRes.ok) setAnimals(await animRes.json());
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/livestock/health-events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setShowForm(false);
        setForm({ status: 'Healthy', eventDate: new Date().toISOString().split('T')[0] });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save health event', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'healthy': return 'bg-emerald-100 text-emerald-700';
      case 'under treatment': return 'bg-amber-100 text-amber-700';
      case 'recovered': return 'bg-blue-100 text-blue-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) return <div className="py-8 text-center text-slate-500">Loading health data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Health Records</h2>
          <p className="text-sm text-slate-500">Log symptoms, treatments and prepare data for AI diagnosis.</p>
        </div>
        <button 
          onClick={() => { setForm({ status: 'Under Treatment', eventDate: new Date().toISOString().split('T')[0] }); setShowForm(true); }}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Add Health Record
        </button>
      </div>

      {showForm && (
        <Card className="mb-6 p-4">
          <h3 className="mb-4 font-semibold">New Health Record</h3>
          <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Select Animal</label>
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.livestockId || ''} onChange={e => setForm({...form, livestockId: e.target.value})}>
                <option value="">Select an animal</option>
                {animals.map(a => (
                  <option key={a.id} value={a.id}>{a.tag_code} ({a.animal_type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input required type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.eventDate || ''} onChange={e => setForm({...form, eventDate: e.target.value})} />
            </div>
            <div className="col-span-full">
              <label className="mb-1 block text-sm font-medium text-slate-700">Health Issue (Title)</label>
              <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.healthIssue || ''} onChange={e => setForm({...form, healthIssue: e.target.value})} placeholder="e.g. Swollen Leg, Routine Checkup" />
            </div>
            <div className="col-span-full">
              <label className="mb-1 block text-sm font-medium text-slate-700">Symptoms</label>
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} value={form.symptoms || ''} onChange={e => setForm({...form, symptoms: e.target.value})} placeholder="Describe symptoms (e.g. Limping, reduced appetite)" />
            </div>
            <div className="col-span-full">
              <label className="mb-1 block text-sm font-medium text-slate-700">Diagnosis</label>
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} value={form.diagnosis || ''} onChange={e => setForm({...form, diagnosis: e.target.value})} placeholder="e.g. Minor infection" />
            </div>
            <div className="col-span-full">
              <label className="mb-1 block text-sm font-medium text-slate-700">Treatment</label>
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} value={form.treatment || ''} onChange={e => setForm({...form, treatment: e.target.value})} placeholder="e.g. Antibiotics for 3 days" />
            </div>
            <div className="col-span-full">
              <label className="mb-1 block text-sm font-medium text-slate-700">Vaccination Details (if any)</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.vaccinationDetails || ''} onChange={e => setForm({...form, vaccinationDetails: e.target.value})} placeholder="e.g. FMD Vaccine Dose 1" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Current Status</label>
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Healthy">Healthy</option>
                <option value="Under Treatment">Under Treatment</option>
                <option value="Recovered">Recovered</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="col-span-full flex gap-3 mt-2">
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Save Record</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4">
        {events.map(ev => (
          <Card key={ev.id} className="p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-800 text-lg">{ev.healthIssue}</h4>
                <div className="text-sm font-medium text-slate-500">
                  Animal: <span className="text-slate-700">{ev.animalTag || 'Unknown'}</span> &bull; {new Date(ev.eventDate).toLocaleDateString()}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${getStatusColor(ev.status)}`}>
                {ev.status}
              </span>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              {ev.symptoms && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Symptoms:</p>
                  <p className="text-slate-600">{ev.symptoms}</p>
                </div>
              )}
              {ev.diagnosis && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Diagnosis:</p>
                  <p className="text-slate-600">{ev.diagnosis}</p>
                </div>
              )}
              {ev.treatment && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Treatment:</p>
                  <p className="text-slate-600">{ev.treatment}</p>
                </div>
              )}
              {ev.vaccinationDetails && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Vaccination:</p>
                  <p className="text-slate-600">{ev.vaccinationDetails}</p>
                </div>
              )}
            </div>
          </Card>
        ))}
        {events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-slate-500">No health records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
