import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CropWeatherAdvicePanel } from '../../components/crops/CropWeatherAdvicePanel';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FiDroplet, FiMapPin, FiEdit2, FiTrash2, FiSearch, FiPlus, FiCheckCircle, FiAlertTriangle, FiDownload, FiChevronLeft, FiChevronRight, FiCalendar, FiList, FiGrid, FiClock, FiMap, FiTag, FiFilter, FiPrinter, FiEye, FiFileText, FiTrendingUp } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../utils/apiFetch';
import { notifySuccess, notifyError } from '../../utils/notifications';
import { EnterpriseHarvestCalendar } from './EnterpriseHarvestCalendar';
import { useNavigate } from 'react-router-dom';
import { generateTextPDF, buildTextPDFFile } from '../../utils/pdfGenerator';
import { BarChart, Bar, CartesianGrid, Cell, Legend, PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, AreaChart, Area } from 'recharts';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

const HARVEST_STATUS_STYLES: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  ready: { label: 'Ready for Harvest', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-300' },
  due: { label: 'Harvest This Week', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-300' },
  today: { label: 'Harvest Today', dot: 'bg-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-300' },
  overdue: { label: 'Overdue', dot: 'bg-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-300' },
  harvested: { label: 'Harvested', dot: 'bg-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300' },
  growing: { label: 'Growing', dot: 'bg-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-300' },
  bearing: { label: 'Bearing', dot: 'bg-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-300' },
  maturing: { label: 'Maturing', dot: 'bg-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-300' },
};

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const startOfWeek = (date: Date) => {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  return addDays(copy, -diff);
};
const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

export default function FarmManagerCropsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<any | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [calendarFilters, setCalendarFilters] = useState({
    crop: [] as string[],
    field: [] as string[],
    status: [] as string[],
    month: [] as string[],
    season: [] as string[],
    variety: [] as string[],
  });
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [harvests, setHarvests] = useState<any[]>([]);
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
  const [cropToDelete, setCropToDelete] = useState<any | null>(null);

  // Disease reports states
  const [diseaseReports, setDiseaseReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStatus, setReportStatus] = useState('Submitted');
  const [reportNotes, setReportNotes] = useState('');
  const [reportPdfFile, setReportPdfFile] = useState<File | null>(null);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
  const [savingReport, setSavingReport] = useState(false);

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
    // For a perennial the planting -> expected window is decades long, so
    // deriving progress from it pins the tree at 100%. The server already
    // tracks progress towards the NEXT pick.
    if (crop.is_perennial && typeof crop.harvest_progress === 'number') return crop.harvest_progress;
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
    if (crop.harvest_status === 'Harvested' || crop.status === 'Harvesting') return 'Harvest';
    if (crop.status === 'Growing') return 'Vegetative';
    if (crop.status === 'Planned' || crop.status === 'planned') return 'Seed';
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

  const calendarEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return crops
      .filter((crop) => !crop.is_historical)
      .filter((crop) => crop.expected_harvest_date || crop.planting_date)
      .map((crop) => {
        const field = fields.find((item) => String(item.id) === String(crop.field_id));
        const plantingDate = crop.planting_date ? startOfDay(new Date(crop.planting_date)) : null;
        const expectedHarvestDate = crop.expected_harvest_date ? startOfDay(new Date(crop.expected_harvest_date)) : null;
        const remainingDays = typeof crop.remaining_days === 'number' ? crop.remaining_days : expectedHarvestDate ? daysBetween(today, expectedHarvestDate) : null;
        const progress = typeof crop.harvest_progress === 'number' ? crop.harvest_progress : getGrowthProgress(crop);
        // A perennial keeps bearing after every pick, so it never reaches the
        // harvested/overdue end states the seasonal ladder below assumes.
        const statusKey = crop.is_perennial
          ? (crop.harvest_status === 'Maturing'
              ? 'maturing'
              : remainingDays === 0
                ? 'today'
                : remainingDays != null && remainingDays <= 7
                  ? 'due'
                  : 'bearing')
          : crop.harvest_status === 'Harvested' || crop.status === 'harvested' || crop.status === 'completed'
            ? 'harvested'
            : remainingDays != null && remainingDays < 0
              ? 'overdue'
              : remainingDays === 0
                ? 'today'
                : remainingDays != null && remainingDays <= 7
                  ? 'due'
                  : progress >= 70
                    ? 'ready'
                    : 'growing';
        return {
          id: crop.id,
          crop,
          field,
          title: crop.crop_name || 'Crop',
          subtitle: field?.field_name || 'Unassigned Field',
          variety: crop.variety || '-',
          season: crop.season || '-',
          date: expectedHarvestDate || plantingDate || today,
          plantingDate,
          expectedHarvestDate,
          remainingDays,
          progress,
          statusKey,
          color: HARVEST_STATUS_STYLES[statusKey],
        };
      })
      .filter((event) => {
        const monthLabel = monthNames[event.date.getMonth()];
        const matches = (values: string[], value: string) => values.length === 0 || values.includes(value);
        return (
          matches(calendarFilters.crop, event.title) &&
          matches(calendarFilters.field, event.subtitle) &&
          matches(calendarFilters.status, event.statusKey) &&
          matches(calendarFilters.month, monthLabel) &&
          matches(calendarFilters.season, event.season) &&
          matches(calendarFilters.variety, event.variety)
        );
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [crops, fields, calendarFilters]);

  const currentMonthEvents = calendarEvents.filter((event) => event.date.getMonth() === calendarMonth && event.date.getFullYear() === calendarYear);
  const currentWeekStart = startOfWeek(calendarCursor);
  const currentWeekEnd = endOfWeek(calendarCursor);
  const weekEvents = calendarEvents.filter((event) => event.date >= currentWeekStart && event.date <= currentWeekEnd);
  const dayEvents = calendarEvents.filter((event) => formatDateKey(event.date) === formatDateKey(calendarCursor));
  const agendaEvents = calendarEvents;

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const inSeven = addDays(today, 7);
    const inMonth = addDays(today, 30);
    return {
      ready: calendarEvents.filter((event) => event.statusKey === 'ready').length,
      week: calendarEvents.filter((event) => event.expectedHarvestDate && event.expectedHarvestDate >= today && event.expectedHarvestDate <= inSeven).length,
      month: calendarEvents.filter((event) => event.expectedHarvestDate && event.expectedHarvestDate >= today && event.expectedHarvestDate <= inMonth).length,
      overdue: calendarEvents.filter((event) => event.statusKey === 'overdue').length,
      harvested: calendarEvents.filter((event) => event.statusKey === 'harvested').length,
      yield: crops.reduce((total, crop) => total + (Number(crop.expected_yield) || 0), 0),
      active: calendarEvents.filter((event) => event.statusKey !== 'harvested').length,
    };
  }, [calendarEvents, crops]);

  const calendarChartData = useMemo(() => {
    const monthly = Array.from({ length: 12 }, (_, index) => ({
      month: monthNames[index].slice(0, 3),
      forecast: calendarEvents.filter((event) => event.date.getMonth() === index).length,
      completed: calendarEvents.filter((event) => event.statusKey === 'harvested' && event.date.getMonth() === index).length,
    }));
    const cropMap = Object.values(calendarEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.title] = (acc[event.title] || 0) + 1;
      return acc;
    }, {})).map(() => 0);
    return { monthly, cropMap };
  }, [calendarEvents]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => current - 2 + index);
  }, []);

  const uniqueValues = (key: 'crop' | 'field' | 'status' | 'month' | 'season' | 'variety') => {
    const values = new Set<string>();
    calendarEvents.forEach((event) => {
      if (key === 'crop') values.add(event.title);
      if (key === 'field') values.add(event.subtitle);
      if (key === 'status') values.add(event.statusKey);
      if (key === 'month') values.add(monthNames[event.date.getMonth()]);
      if (key === 'season') values.add(event.season);
      if (key === 'variety') values.add(event.variety);
    });
    return Array.from(values);
  };

  const toggleCalendarFilter = (key: keyof typeof calendarFilters, value: string) => {
    setCalendarFilters((prev) => {
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? prev[key].filter((item) => item !== value) : [...prev[key], value] };
    });
  };

  const clearCalendarFilters = () => setCalendarFilters({ crop: [], field: [], status: [], month: [], season: [], variety: [] });

  const moveCalendar = (direction: number) => {
    const next = new Date(calendarCursor);
    if (calendarView === 'month') next.setMonth(next.getMonth() + direction);
    else if (calendarView === 'week') next.setDate(next.getDate() + 7 * direction);
    else if (calendarView === 'day') next.setDate(next.getDate() + direction);
    else next.setMonth(next.getMonth() + direction);
    setCalendarCursor(next);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
  };

  const todayCalendar = () => {
    const today = new Date();
    setCalendarCursor(today);
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
  };

  const eventBadge = (event: any) => {
    if (event.statusKey === 'overdue') return '🔥 Overdue';
    if (event.statusKey === 'today') return '🌾 Ready Today';
    if (event.statusKey === 'due') return '⚠ Harvest Tomorrow';
    return '';
  };

  const renderEventCard = (event: any, compact = false) => (
    <motion.button
      key={event.id}
      type="button"
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={() => setHoveredEventId(event.id)}
      onMouseLeave={() => setHoveredEventId(null)}
      onClick={() => setSelectedCalendarEvent(event)}
      className={`group relative w-full overflow-hidden rounded-2xl border ${event.color.border} ${event.color.bg} p-${compact ? '3' : '4'} text-left shadow-lg transition-all`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${event.color.dot}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{event.title}</p>
          <p className="mt-1 truncate text-xs text-slate-300">{event.subtitle}</p>
          <p className="mt-2 text-xs text-slate-400">{event.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${event.color.text} bg-black/20`}>
          {event.statusKey}
        </span>
      </div>
      {eventBadge(event) ? <div className="mt-3 text-xs font-semibold text-amber-200">{eventBadge(event)}</div> : null}
    </motion.button>
  );

  const monthGrid = useMemo(() => {
    const first = new Date(calendarYear, calendarMonth, 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [calendarMonth, calendarYear]);

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

        // Harvests farmers recorded, so they appear on the harvest calendar.
        const harvestsRes = await apiFetch('/api/analytics/harvest-events');
        if (harvestsRes.ok) {
          const harvestsData = await harvestsRes.json();
          setHarvests(Array.isArray(harvestsData) ? harvestsData : []);
        }

        const updatesRes = await apiFetch('/api/crop-observations/recent');
        if (updatesRes.ok) {
          setRecentUpdates(await updatesRes.json());
        }

        const reportsRes = await apiFetch('/api/disease-reports');
        if (reportsRes.ok) {
          setDiseaseReports(await reportsRes.json());
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
        setDiseaseReports([
          { id: '1', farmer_name: 'Worker A', crop_name: 'Tomato', field_name: 'North Field A', title: 'Spots on leaves', description: 'Yellow/black spots observed on bottom leaves.', severity: 'High', status: 'Submitted', reported_at: new Date().toISOString() }
        ]);
      }
    };
    fetchData();
  }, []);

  /**
   * The report document, built once so the copy the manager downloads and the
   * copy attached to a worker's task are always the same.
   */
  const buildReportDoc = (report: any, status?: string, notes?: string) => {
    const title = `Manager Disease Report: ${report.crop_name}`;
    let content = `Date: ${new Date().toLocaleDateString()}\n`;
    content += `Crop: ${report.crop_name}\n`;
    content += `Disease Title: ${report.title}\n`;
    content += `Submitted By: ${report.worker_name || report.farmer_name || 'Worker'}\n`;
    content += `Severity: ${report.severity}\n`;
    content += `Status: ${status ?? report.status}\n\n`;

    if (report.description) {
      content += `Description from worker:\n${report.description}\n\n`;
    }

    const managerNotes = notes ?? report.manager_notes;
    if (managerNotes) {
      content += `Manager Notes & Recommendations:\n${managerNotes}\n`;
    }

    return { title, content, filename: `Disease_Report_${report.crop_name}` };
  };

  /**
   * Hand a report to a worker as a task.
   *
   * Prefers the PDF already saved on the report; only generates a fresh one if
   * the manager never attached anything, so the worker sees the same document
   * the manager filed.
   */
  const assignTaskFromReport = async (report: any) => {
    let attachmentUrl: string | null = report.report_pdf_url || null;
    let attachmentName: string | undefined = report.report_pdf_name || undefined;

    if (!attachmentUrl) {
      try {
        const { title, content, filename } = buildReportDoc(report);
        const form = new FormData();
        form.append('file', buildTextPDFFile(title, content, filename));
        const res = await apiFetch('/api/disease-reports/report-pdf', { method: 'POST', body: form });
        if (res.ok) {
          const saved = await res.json();
          attachmentUrl = saved.url;
          attachmentName = saved.name;
        } else {
          notifyError('Could not attach a report PDF; assigning without it.');
        }
      } catch (err) {
        console.error('Report PDF upload failed', err);
        notifyError('Could not attach a report PDF; assigning without it.');
      }
    }

    navigate('/dashboard/farm-manager/tasks', {
      state: {
        isNewTask: true,
        prefillTitle: `Treat ${report.crop_name} for Disease`,
        prefillDescription: report.manager_notes || `Disease detected: ${report.title}. Please take necessary action.`,
        prefillCategory: 'Planting & Maintenance',
        prefillAttachmentUrl: attachmentUrl,
        prefillAttachmentName: attachmentName,
        // Links the task to the report so the assigned worker sees the
        // symptoms, severity and photo, not just a title.
        prefillDiseaseReportId: report.id
      }
    });
  };

  const handleSaveReport = async () => {
    if (!selectedReport) return;
    setSavingReport(true);
    try {
      // A newly chosen file only exists as a browser blob until it is uploaded;
      // storing that blob URL is what made the attachment vanish on reopen.
      let pdfUrl: string | undefined;
      let pdfName: string | undefined;

      if (reportPdfFile) {
        const form = new FormData();
        form.append('file', reportPdfFile);
        const upload = await apiFetch('/api/disease-reports/report-pdf', { method: 'POST', body: form });
        if (!upload.ok) {
          notifyError('Could not upload the PDF. Nothing was saved.');
          return;
        }
        const saved = await upload.json();
        pdfUrl = saved.url;
        pdfName = saved.name;
      }

      const res = await apiFetch(`/api/disease-reports/${selectedReport.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reportStatus,
          manager_notes: reportNotes,
          report_pdf_url: pdfUrl,
          report_pdf_name: pdfName
        })
      });

      if (res.ok) {
        const { report } = await res.json();
        notifySuccess('Disease report updated successfully!');
        setDiseaseReports(prev => prev.map(r => (r.id === selectedReport.id ? { ...r, ...report } : r)));
        setShowReportModal(false);
        setSelectedReport(null);
        setReportPdfFile(null);
        setReportPdfUrl(null);
      } else {
        notifyError('Failed to update report status');
      }
    } catch (err) {
      console.error(err);
      notifyError('Error updating report status');
    } finally {
      setSavingReport(false);
    }
  };

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
      const response = await apiFetch(`/api/crops/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete crop');
      }
      setCrops((prev) => prev.filter(c => c.id !== id));
      notifySuccess('Crop deleted successfully.');
    } catch (err) {
      console.error('Error deleting crop', err);
      notifyError(err instanceof Error ? err.message : 'Failed to delete crop');
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
        const cropData = saved.crop || saved;
        if (editingCropId) {
          setCrops((prev) => prev.map(c => c.id === editingCropId ? cropData : c));
        } else {
          setCrops((prev) => [...prev, cropData]);
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
        {['dashboard', 'crops', 'calendar', 'growth', 'disease-reports'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${activeTab === tab
                ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-800 border border-white/5'
              }`}
          >
            {tab === 'dashboard' ? t('Overview') : tab === 'disease-reports' ? t('Disease Reports') : tab === 'calendar' ? t('Harvest Calendar') : t(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title={t("Total Crops")} subtitle={t("All registered crops")}>
              <p className="text-5xl font-black text-emerald-400 mt-2">{crops.length}</p>
            </Card>
            <Card title={t("Active Fields")} subtitle={t("Currently in use")}>
              <p className="text-5xl font-black text-lime-400 mt-2">{fields.length}</p>
            </Card>
          </div>

          <CropWeatherAdvicePanel />
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
                  <th className="px-6 py-4">{t("Expected Harvest Date")}</th>
                  <th className="px-6 py-4">{t("Harvested Date")}</th>
                  <th className="px-6 py-4">{t("Harvest Status")}</th>
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
                    <td className="px-6 py-4 text-slate-300">{c.expected_harvest_date ? new Date(c.expected_harvest_date).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-slate-300">
                      {c.actual_harvest_date ? new Date(c.actual_harvest_date).toLocaleDateString() : '-'}
                      {/* A perennial has been picked many times; the date above is the latest. */}
                      {c.is_perennial && c.harvest_count > 0 && (
                        <span className="ml-2 text-xs text-slate-500">({c.harvest_count} harvests)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${c.harvest_status === 'Harvested' ? 'bg-emerald-500/10 text-emerald-300' :
                          c.harvest_status === 'Bearing' ? 'bg-teal-500/10 text-teal-300' :
                          c.harvest_status === 'Maturing' ? 'bg-indigo-500/10 text-indigo-300' :
                          c.harvest_status === 'Ready for Harvest' || c.harvest_status === 'Harvest Due' ? 'bg-amber-500/10 text-amber-300' :
                            'bg-slate-500/10 text-slate-300'
                        }`}>
                        {c.harvest_status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${c.status === 'Growing' || c.status === 'growing'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : c.status === 'harvested' || c.status === 'completed'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}
                      >
                        {c.is_perennial ? 'Bearing' : c.status === 'harvested' ? 'Completed' : c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-4">
                      <button onClick={() => handleEditCrop(c)} className="text-blue-400 hover:text-blue-300 transition-colors" title="Edit">
                        <FiEdit2 className="text-lg" />
                      </button>
                      <button onClick={() => setCropToDelete(c)} className="text-rose-400 hover:text-rose-300 transition-colors" title="Delete">
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

      {activeTab === 'calendar' && <EnterpriseHarvestCalendar crops={crops} fields={fields} harvests={harvests} t={t} />}

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
                    <th className="px-6 py-4">{t("Remaining Days")}</th>
                    <th className="px-6 py-4">{t("Harvest Status")}</th>
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
                              <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${crop.harvest_progress || progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-300">{crop.harvest_progress || progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{crop.expected_harvest_date ? new Date(crop.expected_harvest_date).toLocaleDateString() : '-'}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-300">
                          {crop.remaining_days != null ? `${crop.remaining_days} days` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${crop.harvest_status === 'Harvested' ? 'bg-emerald-500/10 text-emerald-300' :
                              crop.harvest_status === 'Ready for Harvest' ? 'bg-amber-500/10 text-amber-300' :
                                'bg-slate-500/10 text-slate-300'
                            }`}>
                            {crop.harvest_status || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${progress >= 75 ? 'bg-emerald-500/10 text-emerald-300' : progress >= 45 ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'
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
                {/* A perennial sitting at low progress is simply between picks, not delayed. */}
                {crops.filter((crop) => !crop.is_perennial && getGrowthProgress(crop) < 45).length === 0 ? (
                  <p className="text-sm text-slate-400">{t("No alerts right now.")}</p>
                ) : crops.filter((crop) => !crop.is_perennial && getGrowthProgress(crop) < 45).map((crop) => (
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

      {activeTab === 'disease-reports' && (
        <Card title={t("Disease Reports")} subtitle={t("Review farmer-submitted disease observations and update statuses")}>
          {diseaseReports.length === 0 ? (
            <div className="py-8 text-center text-slate-500">{t("No disease reports found.")}</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/90 text-white font-semibold">
                  <tr>
                    <th className="px-6 py-4">{t("Crop")}</th>
                    <th className="px-6 py-4">{t("Field")}</th>
                    <th className="px-6 py-4">{t("Title")}</th>
                    <th className="px-6 py-4">{t("Farmer")}</th>
                    <th className="px-6 py-4">{t("Severity")}</th>
                    <th className="px-6 py-4">{t("Status")}</th>
                    <th className="px-6 py-4 text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/60">
                  {diseaseReports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{report.crop_name}</td>
                      <td className="px-6 py-4">{report.field_name}</td>
                      <td className="px-6 py-4 font-medium text-slate-200">{report.title}</td>
                      <td className="px-6 py-4 text-slate-400">{report.farmer_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${report.severity === 'High' || report.severity === 'Emergency'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : report.severity === 'Medium'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                          {report.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${report.status === 'Resolved'
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                            : report.status === 'Submitted'
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-700/30 text-slate-300 border border-slate-600/20'
                          }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          onClick={() => {
                            setSelectedReport(report);
                            setReportStatus(report.status);
                            setReportNotes(report.manager_notes || '');
                            setShowReportModal(true);
                          }}
                          className="py-1 px-3 text-xs"
                        >
                          {t("Review")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => assignTaskFromReport(report)}
                          className="ml-2 py-1 px-3 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border-emerald-500/30"
                        >
                          <FiPlus className="mr-1 inline" /> {t("Assign Task")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Disease Report Review Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div id="disease-report-modal-content" className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-white mb-2">{t('Review Disease Report')}</h3>
            <p className="text-slate-400 text-sm mb-6">{selectedReport.crop_name} - {selectedReport.field_name}</p>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">{t("Title")}</span>
                <p className="text-white font-medium">{selectedReport.title}</p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">{t("Description")}</span>
                <p className="text-slate-300 bg-slate-950/40 p-3 rounded-2xl border border-white/5 text-sm whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">{t("Severity")}</span>
                  <span className="text-amber-400 font-bold">{selectedReport.severity}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">{t("Affected Plants")}</span>
                  <span className="text-white font-bold">{selectedReport.affected_plants || t("N/A")}</span>
                </div>
              </div>

              {selectedReport.image_urls && selectedReport.image_urls.length > 0 && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">{t("Evidence Image")}</span>
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-950">
                    <img
                      src={selectedReport.image_urls[0].startsWith('http') || selectedReport.image_urls[0].startsWith('blob:') || selectedReport.image_urls[0].startsWith('data:') ? selectedReport.image_urls[0] : `http://localhost:5000${selectedReport.image_urls[0].startsWith('/') ? '' : '/'}${selectedReport.image_urls[0]}`}
                      alt="Disease evidence"
                      className="w-full h-auto max-h-60 object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      const url = selectedReport.image_urls[0].startsWith('http') || selectedReport.image_urls[0].startsWith('blob:') || selectedReport.image_urls[0].startsWith('data:') ? selectedReport.image_urls[0] : `http://localhost:5000${selectedReport.image_urls[0].startsWith('/') ? '' : '/'}${selectedReport.image_urls[0]}`;
                      try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `Disease_Report_${selectedReport.crop_name}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(blobUrl);
                      } catch (err) {
                        console.error('Download failed, opening in new tab', err);
                        window.open(url, '_blank');
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium bg-transparent border-none p-0 cursor-pointer"
                  >
                    <FiDownload /> {t("Download Image")}
                  </button>
                </div>
              )}

              <div className="border-t border-white/10 my-4 pt-4"></div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-white/80">{t("Update Status")}</label>
                <select
                  value={reportStatus}
                  onChange={e => setReportStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 text-white p-2.5 rounded-2xl focus:outline-none focus:border-emerald-500 text-sm font-medium"
                >
                  <option value="Submitted">{t("Submitted")}</option>
                  <option value="Under Review">{t("Under Review")}</option>
                  <option value="Resolved">{t("Resolved")}</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-white/80">{t("Manager Notes & Recommendations")}</label>
                <textarea
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  placeholder={t("Enter treatment recommendation or review comments...")}
                  className="w-full bg-slate-800 border border-white/10 text-white p-3 rounded-2xl focus:outline-none focus:border-emerald-500 text-sm font-medium min-h-24"
                />
              </div>
              <div className="mt-4">
                <label className="block mb-2 text-sm font-semibold text-white/80">{t("Upload PDF Attachment")}</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReportPdfFile(file);
                      setReportPdfUrl(URL.createObjectURL(file));
                    }
                  }}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-600/20 file:text-emerald-400 hover:file:bg-emerald-600/30"
                />
                {reportPdfFile ? (
                  <p className="text-xs text-emerald-400 mt-2">{t('Will be saved')}: {reportPdfFile.name}</p>
                ) : selectedReport.report_pdf_url ? (
                  <a
                    href={`http://localhost:5000${selectedReport.report_pdf_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:underline"
                  >
                    <FiFileText /> {selectedReport.report_pdf_name || t('Open saved PDF')}
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">{t('No PDF saved for this report yet.')}</p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const { title, content, filename } = buildReportDoc(selectedReport, reportStatus, reportNotes);
                    generateTextPDF(title, content, filename);
                  }}
                  className="flex items-center gap-2"
                >
                  <FiPrinter /> {t("Generate PDF")}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setShowReportModal(false); setSelectedReport(null); setReportPdfFile(null); setReportPdfUrl(null); }}>
                  {t("Cancel")}
                </Button>
                <Button onClick={handleSaveReport} disabled={savingReport}>{savingReport ? t("Saving...") : t("Save Updates")}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cropToDelete)}
        title="Delete crop?"
        description={cropToDelete ? `Delete "${cropToDelete.crop_name}" permanently? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setCropToDelete(null)}
        onConfirm={async () => {
          if (!cropToDelete) return;
          await handleDeleteCrop(cropToDelete.id);
          setCropToDelete(null);
        }}
      />
    </div>
  );
}
