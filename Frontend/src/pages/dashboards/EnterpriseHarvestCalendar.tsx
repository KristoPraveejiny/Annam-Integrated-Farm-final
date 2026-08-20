import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiFilter, FiX } from 'react-icons/fi';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const statusStyles: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  ready: { label: 'Ready for Harvest', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-300' },
  due: { label: 'Harvest This Week', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-300' },
  today: { label: 'Harvest Today', dot: 'bg-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-300' },
  overdue: { label: 'Overdue', dot: 'bg-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-300' },
  harvested: { label: 'Harvested', dot: 'bg-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300' },
  growing: { label: 'Growing', dot: 'bg-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-300' },
  bearing: { label: 'Bearing', dot: 'bg-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-300' },
  maturing: { label: 'Maturing', dot: 'bg-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-300' },
  recorded: { label: 'Harvest Recorded', dot: 'bg-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20', text: 'text-lime-300' },
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const startOfWeek = (date: Date) => addDays(startOfDay(date), -((startOfDay(date).getDay() + 6) % 7));
const formatKey = (date: Date) => date.toISOString().slice(0, 10);

export function EnterpriseHarvestCalendar({ crops, fields, t, harvests = [] }: { crops: any[]; fields: any[]; t: (value: string) => string; harvests?: any[] }) {
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [filters, setFilters] = useState<Record<string, string[]>>({ crop: [], field: [], status: [], month: [], season: [], variety: [] });
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const events = useMemo(() => {
    const today = startOfDay(new Date());

    // Harvests a farmer actually recorded, shown on the day they happened
    // alongside the upcoming/expected harvest markers below.
    const recordedEvents = harvests.map((harvest) => {
      const field = fields.find((item) => String(item.id) === String(harvest.field_id));
      const date = harvest.harvest_date ? startOfDay(new Date(harvest.harvest_date)) : today;
      return {
        id: `harvest-${harvest.id}`,
        crop: harvest,
        harvest,
        field,
        date,
        remaining: Math.round((date.getTime() - today.getTime()) / 86400000),
        progress: 100,
        statusKey: 'recorded',
        title: harvest.crop_name,
        subtitle: harvest.field_name || field?.field_name || 'Unassigned',
        variety: harvest.variety || '-',
        season: harvest.season || '-',
        color: statusStyles.recorded,
      };
    });

    const cycleEvents = crops.filter((crop) => !crop.is_historical).map((crop) => {
      const field = fields.find((item) => String(item.id) === String(crop.field_id));
      const date = crop.expected_harvest_date ? startOfDay(new Date(crop.expected_harvest_date)) : crop.planting_date ? startOfDay(new Date(crop.planting_date)) : today;
      const remaining = crop.remaining_days ?? Math.round((date.getTime() - today.getTime()) / 86400000);
      const progress = typeof crop.harvest_progress === 'number' ? crop.harvest_progress : Number(crop.growth_percentage ?? 0);
      // A perennial keeps bearing, so it never reaches the harvested/overdue
      // end states the seasonal ladder below assumes.
      const statusKey = crop.is_perennial
        ? (crop.harvest_status === 'Maturing' ? 'maturing' : remaining === 0 ? 'today' : remaining <= 7 ? 'due' : 'bearing')
        : crop.harvest_status === 'Harvested' || crop.status === 'completed' ? 'harvested' : remaining < 0 ? 'overdue' : remaining === 0 ? 'today' : remaining <= 7 ? 'due' : progress >= 70 ? 'ready' : 'growing';
      return { id: crop.id, crop, harvest: null, field, date, remaining, progress, statusKey, title: crop.crop_name, subtitle: field?.field_name || 'Unassigned', variety: crop.variety || '-', season: crop.season || '-', color: statusStyles[statusKey] };
    });

    return [...cycleEvents, ...recordedEvents].filter((event) => {
      const matches = (key: string, value: string) => filters[key].length === 0 || filters[key].includes(value);
      return matches('crop', event.title) && matches('field', event.subtitle) && matches('status', event.statusKey) && matches('month', monthNames[event.date.getMonth()]) && matches('season', event.season) && matches('variety', event.variety);
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [crops, fields, filters, harvests]);

  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const monthGrid = useMemo(() => { const first = new Date(year, month, 1); const start = startOfWeek(first); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); }, [month, year]);
  const monthEvents = events.filter((event) => event.date.getMonth() === month && event.date.getFullYear() === year);
  const weekStart = startOfWeek(cursor);
  const weekEvents = events.filter((event) => event.date >= weekStart && event.date <= addDays(weekStart, 6));
  const dayEvents = events.filter((event) => formatKey(event.date) === formatKey(cursor));
  const stats = { ready: events.filter((event) => event.statusKey === 'ready').length, week: events.filter((event) => event.statusKey === 'due').length, month: monthEvents.length, overdue: events.filter((event) => event.statusKey === 'overdue').length, harvested: events.filter((event) => event.statusKey === 'harvested').length, yield: crops.reduce((total, crop) => total + (Number(crop.expected_yield) || 0), 0), active: events.filter((event) => event.statusKey !== 'harvested').length };
  const toggle = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value] }));
  const unique = (key: string) => Array.from(new Set(events.map((event: any) => key === 'crop' ? event.title : key === 'field' ? event.subtitle : key === 'status' ? event.statusKey : key === 'month' ? monthNames[event.date.getMonth()] : key === 'season' ? event.season : event.variety)));
  const shift = (delta: number) => { const next = new Date(cursor); if (view === 'day') next.setDate(next.getDate() + delta); else if (view === 'week') next.setDate(next.getDate() + delta * 7); else next.setMonth(next.getMonth() + delta); setCursor(next); };
  const EventCard = ({ event, compact = false }: { event: any; compact?: boolean }) => (
    <motion.button
      layout
      whileHover={{ scale: 1.02 }}
      onMouseEnter={() => setHoveredId(event.id)}
      onMouseLeave={() => setHoveredId(null)}
      onClick={() => setActiveEvent(event)}
      className={`relative w-full overflow-hidden rounded-2xl border ${event.color.border} ${event.color.bg} ${compact ? 'p-3' : 'p-4'} text-left`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${event.color.dot}`} />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-semibold text-white">{event.title}</div><div className="truncate text-xs text-slate-300">{event.subtitle}</div></div><div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${event.color.text}`}>{event.statusKey}</div></div>
        <div className="mt-2 text-xs text-slate-400">{event.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
      </div>
      {hoveredId === event.id && <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl">{event.title}<br />{event.subtitle}<br />{event.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}<br />Remaining: {Math.max(0, event.remaining)} days</div>}
    </motion.button>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-7">{[['Ready for Harvest', stats.ready], ['Harvest Due This Week', stats.week], ['Harvest Due This Month', stats.month], ['Overdue Harvests', stats.overdue], ['Recently Harvested', stats.harvested], ['Estimated Yield', `${stats.yield.toFixed(1)} Tons`], ['Active Crop Cycles', stats.active]].map(([label, value]) => <Card key={label as string} title={label as string}><div className="mt-2 text-4xl font-black text-white">{value as any}</div></Card>)}</div>
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card title="Legend" subtitle="Color key">
            <div className="space-y-2">
              {Object.values(statusStyles).map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className={`h-3 w-3 rounded-full ${item.dot}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Calendar Tips" subtitle="Best used at a glance">
            <div className="space-y-2 text-sm text-slate-300">
              <p>• Month view for planning.</p>
              <p>• Week and day views for operations.</p>
              <p>• Click any event for full details.</p>
            </div>
          </Card>
        </aside>
        <div className="space-y-6">
          <Card title={t('Harvest Calendar')} subtitle="Enterprise scheduling view">
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
              <Button variant="ghost" onClick={() => shift(-1)}><FiChevronLeft className="mr-2" />Previous</Button>
              <Button variant="ghost" onClick={() => setCursor(new Date())}>Today</Button>
              <Button variant="ghost" onClick={() => shift(1)}>Next<FiChevronRight className="ml-2" /></Button>
              <select className="farm-input" value={view} onChange={(e) => setView(e.target.value as CalendarView)}><option value="month">Month</option><option value="week">Week</option><option value="day">Day</option><option value="agenda">Agenda</option></select>
              <select className="farm-input" value={month} onChange={(e) => setCursor(new Date(year, Number(e.target.value), 1))}>{monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
              <select className="farm-input" value={year} onChange={(e) => setCursor(new Date(Number(e.target.value), month, 1))}>{Array.from({ length: 7 }, (_, i) => year - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-300"><FiCalendar />{monthNames[month]} {year}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {(['crop', 'field', 'status', 'month', 'season', 'variety'] as const).map((key) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <FiFilter /> {key}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {unique(key).slice(0, 5).map((value) => (
                      <button
                        key={value}
                        onClick={() => toggle(key, value)}
                        className={`rounded-full border px-3 py-1 text-xs ${filters[key].includes(value) ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300'}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            {view === 'month' && (
              <div className="grid grid-cols-7 gap-2">
                {monthGrid.map((date) => {
                  const dayEvents = monthEvents.filter((event) => formatKey(event.date) === formatKey(date));
                  const isToday = formatKey(date) === formatKey(new Date());
                  return (
                    <div
                      key={formatKey(date)}
                      className={`min-h-36 rounded-2xl border p-3 ${date.getMonth() === month ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-50'} ${isToday ? 'shadow-[0_0_24px_rgba(34,197,94,0.12)] ring-1 ring-emerald-500/30' : ''}`}
                    >
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-white">
                        <span>{date.getDate()}</span>
                        {dayEvents.length > 0 && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dayEvents.slice(0, 3).map((event) => (
                          <EventCard key={event.id} event={event} compact />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {view === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date) => {
                  const dayEvents = weekEvents.filter((event) => formatKey(event.date) === formatKey(date));
                  return (
                    <div key={formatKey(date)} className="min-h-56 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                        {date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="mb-3 text-lg font-bold text-white">{date.getDate()}</div>
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <EventCard key={event.id} event={event} compact />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {view === 'day' && (
              <div className="space-y-3">
                {dayEvents.length ? dayEvents.map((event) => <EventCard key={event.id} event={event} />) : <div className="py-10 text-center text-slate-400">No harvests for this day</div>}
              </div>
            )}
            {view === 'agenda' && (
              <div className="space-y-3">
                {events.length ? events.map((event) => <EventCard key={event.id} event={event} />) : <div className="py-10 text-center text-slate-400">No harvests found</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {activeEvent && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">{activeEvent.crop.crop_name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{activeEvent.subtitle}</p>
                </div>
                <button onClick={() => setActiveEvent(null)}>
                  <FiX />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Crop</div>
                  <div className="mt-2 text-white">{activeEvent.crop.crop_name}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Field</div>
                  <div className="mt-2 text-white">{activeEvent.subtitle}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Expected Harvest</div>
                  <div className="mt-2 text-white">{activeEvent.date.toLocaleDateString()}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</div>
                  <div className={`mt-2 ${activeEvent.color.text}`}>{activeEvent.color.label}</div>
                </div>
              </div>

              {activeEvent.harvest ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-lime-500/20 bg-lime-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Quantity harvested</div>
                    <div className="mt-2 text-white">
                      {Number(activeEvent.harvest.quantity || 0).toLocaleString()} {activeEvent.harvest.unit}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recorded by</div>
                    <div className="mt-2 text-white">{activeEvent.harvest.recorded_by_name || 'Imported record'}</div>
                  </div>
                  {Number(activeEvent.harvest.total_revenue) > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Value</div>
                      <div className="mt-2 text-white">Rs. {Number(activeEvent.harvest.total_revenue).toFixed(2)}</div>
                    </div>
                  )}
                  {activeEvent.harvest.notes && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Notes</div>
                      <div className="mt-2 text-white">{activeEvent.harvest.notes}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                    <span>Growing Progress</span>
                    <span>{Math.round(activeEvent.progress)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
                      style={{ width: `${Math.max(5, Math.min(100, activeEvent.progress))}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setActiveEvent(null)}>Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
