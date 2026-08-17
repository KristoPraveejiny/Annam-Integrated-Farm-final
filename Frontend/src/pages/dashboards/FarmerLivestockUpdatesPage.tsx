import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { completeFeedSchedule, getFeedSchedules, getFeedSummary, type FeedSchedule } from '../../api/livestock';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';
import { FiCalendar, FiCheckCircle, FiDroplet } from 'react-icons/fi';

export default function FarmerLivestockUpdatesPage() {
  const [schedules, setSchedules] = useState<FeedSchedule[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [feedGiven, setFeedGiven] = useState('');
  const [waterGiven, setWaterGiven] = useState('');
  const [appetite, setAppetite] = useState('Good');
  const [healthObservation, setHealthObservation] = useState('Normal');
  const [notes, setNotes] = useState('');

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId],
  );

  const loadData = async () => {
    try {
      const [scheduleResult, summaryResult] = await Promise.allSettled([getFeedSchedules(), getFeedSummary()]);
      if (scheduleResult.status === 'fulfilled') {
        setSchedules(scheduleResult.value);
        if (!selectedScheduleId && scheduleResult.value[0]) {
          setSelectedScheduleId(scheduleResult.value[0].id);
        }
      }
      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      }
      if (scheduleResult.status === 'rejected' && summaryResult.status === 'rejected') {
        throw scheduleResult.reason ?? summaryResult.reason;
      }
    } catch (error) {
      console.error('Failed to load livestock updates:', error);
      notifyError('Failed to load livestock updates.');
    }
  };

  useEffect(() => {
    loadData();
  }, [scheduleDate]);

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSchedule) {
      notifyWarning('Please select a feeding task.');
      return;
    }

    try {
      await completeFeedSchedule(selectedSchedule.id, {
        feedGiven,
        waterGiven,
        appetite,
        healthObservation,
        notes,
      });
      notifySuccess('Feeding completed successfully.');
      setFeedGiven('');
      setWaterGiven('');
      setAppetite('Good');
      setHealthObservation('Normal');
      setNotes('');
      await loadData();
    } catch (error) {
      console.error('Failed to complete feeding:', error);
      notifyError('Failed to complete feeding.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow="Livestock Updates"
        title="Livestock Feeding"
        description="Review assigned feeding tasks and submit the actual feed and water given."
        tone="light"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Animals Fed Today"><p className="mt-2 text-4xl font-black text-white">{summary.animalsFedToday ?? 0}</p></Card>
        <Card title="Pending Feedings"><p className="mt-2 text-4xl font-black text-white">{summary.pendingFeedings ?? 0}</p></Card>
        <Card title="Missed Feedings"><p className="mt-2 text-4xl font-black text-white">{summary.missedFeedings ?? 0}</p></Card>
        <Card title="Feed Used Today"><p className="mt-2 text-4xl font-black text-white">{summary.actualFeed ?? 0} kg</p></Card>
        <Card title="Water Used Today"><p className="mt-2 text-4xl font-black text-white">{summary.actualWater ?? 0} L</p></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card title="Feeding Tasks" subtitle="Select one task to complete">
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <FiCalendar className="text-emerald-300" />
            <input className="w-full bg-transparent text-white outline-none" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>

          <div className="space-y-3">
            {schedules.length === 0 ? (
              <p className="text-sm text-slate-400">No feed schedules found.</p>
            ) : schedules.map((schedule) => (
              <button
                key={schedule.id}
                onClick={() => setSelectedScheduleId(schedule.id)}
                className={`w-full rounded-3xl border p-4 text-left transition ${
                  selectedScheduleId === schedule.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-slate-950/35 hover:bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{schedule.animalTag || schedule.livestockId}</p>
                    <p className="mt-1 text-xs text-slate-400">{schedule.feedType}</p>
                  </div>
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">{schedule.scheduledTime}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{schedule.feedAmount}</span>
                  <span>{schedule.waterRequirement}</span>
                  <span className="rounded-full bg-white/5 px-2 py-1">{schedule.status}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Complete Feeding" subtitle="Enter actual feed and water values">
          {selectedSchedule ? (
            <form onSubmit={handleComplete} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{selectedSchedule.animalTag || selectedSchedule.livestockId}</p>
                    <p className="text-xs text-slate-400">{selectedSchedule.feedType} • {selectedSchedule.scheduledTime}</p>
                  </div>
                  <FiDroplet className="text-2xl text-emerald-300" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/45 p-3 text-sm text-slate-300">Feed Required: <span className="font-semibold text-white">{selectedSchedule.feedAmount}</span></div>
                  <div className="rounded-2xl bg-slate-950/45 p-3 text-sm text-slate-300">Water Required: <span className="font-semibold text-white">{selectedSchedule.waterRequirement}</span></div>
                </div>
              </div>

              <input className="farm-input" placeholder="Feed given (kg)" value={feedGiven} onChange={(e) => setFeedGiven(e.target.value)} />
              <input className="farm-input" placeholder="Water given (L)" value={waterGiven} onChange={(e) => setWaterGiven(e.target.value)} />
              <select className="farm-input" value={appetite} onChange={(e) => setAppetite(e.target.value)}>
                <option>Excellent</option>
                <option>Good</option>
                <option>Average</option>
                <option>Poor</option>
              </select>
              <select className="farm-input" value={healthObservation} onChange={(e) => setHealthObservation(e.target.value)}>
                <option>Normal</option>
                <option>Weak</option>
                <option>Sick</option>
              </select>
              <textarea className="farm-input md:col-span-2 min-h-28" placeholder="Remarks" value={notes} onChange={(e) => setNotes(e.target.value)} />

              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setSelectedScheduleId('')}>
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-2">
                  <FiCheckCircle /> Complete Task
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-6 text-slate-400">Select a feeding task to complete it.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
