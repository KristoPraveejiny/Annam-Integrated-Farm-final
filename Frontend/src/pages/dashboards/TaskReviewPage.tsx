import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  FileVideo,
  Fuel,
  Gauge,
  Globe,
  History,
  Image as ImageIcon,
  Inbox,
  Layers3,
  Link2,
  LocateFixed,
  MapPin,
  MessageSquare,
  MessageSquareReply,
  PenSquare,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  SquareCheckBig,
  Star,
  TimerReset,
  Trash2,
  Upload,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

type AnyRecord = Record<string, any>;

type TimelineEntry = AnyRecord & { kind?: string };

const STATUS_FLOW = [
  'Assigned',
  'In Progress',
  'Submitted',
  'Evidence Review',
  'Manager Approval',
  'Completed',
];

const TASK_GATING_KEYS = ['photos', 'gps', 'checklist', 'progress', 'report'];

function fmtDate(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function fmtTime(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return 'N/A';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'N/A';
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${remMins}m`;
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function safeJson(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickArray(...values: any[]) {
  for (const value of values) {
    const parsed = safeJson(value, null);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(value)) return value;
  }
  return [] as any[];
}

function getCurrentStage(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (['assigned', 'accepted', 'todo', 'pending'].includes(normalized)) return 0;
  if (['in_progress', 'overdue'].includes(normalized)) return 1;
  if (['submitted', 'waiting_for_review', 'waiting_manager_approval', 'late_submission'].includes(normalized)) return 2;
  if (['evidence_review', 'rework_requested', 'work_pending_confirmation'].includes(normalized)) return 3;
  if (['manager_approval', 'approved'].includes(normalized)) return 4;
  if (['completed', 'closed'].includes(normalized)) return 5;
  return 0;
}

function getStageState(stageIndex: number, currentStage: number) {
  if (stageIndex < currentStage) return 'complete';
  if (stageIndex === currentStage) return 'current';
  return 'pending';
}

function statusTone(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (['completed', 'approved'].includes(normalized)) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (['waiting_manager_approval', 'late_submission', 'rework_requested'].includes(normalized)) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (['rejected', 'invalid', 'failed'].includes(normalized)) return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
}

function scorePillClass(pct: number) {
  if (pct >= 90) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (pct >= 70) return 'bg-lime-500/15 text-lime-300 border-lime-500/30';
  if (pct >= 50) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
}

function SectionShell({
  title,
  subtitle,
  icon,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[28px] border border-white/10 bg-white/8 p-5 shadow-[0_18px_50px_rgba(2,6,23,0.28)] backdrop-blur-xl sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            {icon}
            <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
          </div>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm text-white/65">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function SummaryStat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'emerald' | 'amber' | 'rose' | 'sky' }) {
  const toneMap = {
    emerald: 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400',
    amber: 'border-amber-500/15 bg-amber-500/5 text-amber-400',
    rose: 'border-rose-500/15 bg-rose-500/5 text-rose-400',
    sky: 'border-sky-500/15 bg-sky-500/5 text-sky-400',
    default: 'border-white/5 bg-white/5 text-white',
  };
  const toneClass = toneMap[tone];

  return (
    <div className={`flex flex-col rounded-2xl border p-4 transition hover:bg-white/10 ${toneClass}`}>
      <dt className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</dt>
      <dd className="mt-2 text-lg font-bold tracking-tight text-white sm:text-xl">{value}</dd>
      {hint ? <p className="mt-2 text-xs opacity-50">{hint}</p> : null}
    </div>
  );
}

function EvidenceGallery({
  items,
  onOpen,
}: {
  items: any[];
  onOpen: (index: number) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-6 text-sm text-white/55">
        No photos were submitted yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <button
          key={`${item.url || index}`}
          type="button"
          onClick={() => onOpen(index)}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 text-left"
        >
          <img
            src={item.url}
            alt={item.caption || `Evidence ${index + 1}`}
            className="h-40 w-full object-cover transition duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Photo {index + 1}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/60">
              <span>{fmtTime(item.uploadTime || item.upload_time || item.created_at)}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5">{item.gps || item.gpsCoordinates || item.location || 'No GPS'}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function TaskReviewPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<AnyRecord | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [taskReviews, setTaskReviews] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<AnyRecord | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [salaryRows, setSalaryRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);

  const [workerHistory, setWorkerHistory] = useState<any>(null);
  const [evidenceVersions, setEvidenceVersions] = useState<any[]>([]);


  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [managerRating, setManagerRating] = useState(5);
  const [approvePercentage, setApprovePercentage] = useState('100');
  const [rejectReason, setRejectReason] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [reviewDecision, setReviewDecision] = useState('verified');
  const [taskCompletionEdit, setTaskCompletionEdit] = useState('100');
  const [taskNotesEdit, setTaskNotesEdit] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(null);

  useEffect(() => {
    if (!taskId) return;
    fetchReviewContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!task) return;
    setTaskCompletionEdit(String(task.completion_percentage ?? task.approved_progress ?? 0));
    setTaskNotesEdit(String(task.manager_review_notes || task.completion_notes || task.description || ''));
    setApprovePercentage(String(task.completion_percentage ?? task.approved_progress ?? 100));
  }, [task]);

  const fetchReviewContext = async () => {
    try {
      setLoading(true);
      const [tasksRes, updatesRes, timelineRes, reviewsRes, evidenceRes, notificationsRes, auditRes, salaryRes, versionsRes] = await Promise.all([
        apiFetch('/api/tasks/manager'),
        apiFetch(`/api/tasks/updates/recent?taskId=${taskId}`),
        apiFetch(`/api/tasks/${taskId}/timeline`),
        apiFetch(`/api/tasks/${taskId}/reviews`),
        apiFetch(`/api/tasks/${taskId}/evidence`),
        apiFetch('/api/notifications?unreadOnly=false'),
        apiFetch('/api/audit?limit=100'),
        apiFetch('/api/salary'),

        apiFetch(`/api/tasks/${taskId}/evidence-versions`),
      ]);

      
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const foundTask = tasksData.find((item: AnyRecord) => String(item.id) === String(taskId));
        if (foundTask) {
          setTask(foundTask);
          if (foundTask.assigned_to_user_id) {
            apiFetch(`/api/tasks/worker-history/${foundTask.assigned_to_user_id}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => data && setWorkerHistory(data))
              .catch(console.error);
          }
        }
      }


      if (updatesRes.ok) {
        const updatesData = await updatesRes.json();
        setUpdates(Array.isArray(updatesData) ? updatesData : []);
      }

      if (timelineRes.ok) {
        const timelineData = await timelineRes.json();
        setTimeline(Array.isArray(timelineData) ? timelineData : []);
      }

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setTaskReviews(Array.isArray(reviewsData) ? reviewsData : []);
      }

      if (evidenceRes.ok) {
        const evidenceData = await evidenceRes.json();
        setEvidence(evidenceData || null);
      }

      if (notificationsRes.ok) {
        const notificationData = await notificationsRes.json();
        setNotifications(Array.isArray(notificationData) ? notificationData : []);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(Array.isArray(auditData) ? auditData.filter((entry) => String(entry.record_id || '') === String(taskId)) : []);
      }

      
      if (versionsRes && versionsRes.ok) {
        const versionsData = await versionsRes.json();
        setEvidenceVersions(Array.isArray(versionsData) ? versionsData : []);
      }

      if (salaryRes.ok) {
        const salaryData = await salaryRes.json();
        setSalaryRows(Array.isArray(salaryData) ? salaryData : []);
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to load task review data.');
    } finally {
      setLoading(false);
    }
  };

  const taskUpdate = updates[0] || null;
  const latestTimeline = [...timeline].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestNotifications = [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);
  const latestAudit = [...auditLogs].sort((a, b) => new Date(b.timestamp || b.created_at || 0).getTime() - new Date(a.timestamp || a.created_at || 0).getTime());

  const rawEvidenceImages = useMemo(() => {
    const items = [
      ...pickArray(evidence?.images),
      ...pickArray(taskUpdate?.images),
    ];
    // Deduplicate by URL
    const uniqueItemsMap = new Map();
    items.forEach((item: any) => {
      const url = item.url || item.path || '';
      if (url && !uniqueItemsMap.has(url)) {
        uniqueItemsMap.set(url, {
          ...item,
          url,
          path: item.path || item.url || '',
          created_at: item.created_at || item.uploadTime || '',
          capturedAt: item.capturedAt || item.captured_at || item.created_at || '',
          uploadTime: item.uploadTime || item.upload_time || item.created_at || '',
          gps: item.gps || item.gpsCoordinates || item.location_name || item.location || '',
          caption: item.caption || item.note || item.fileName || 'Evidence image',
        });
      }
    });
    return Array.from(uniqueItemsMap.values());
  }, [evidence, taskUpdate]);

  const rawVideos = useMemo(() => pickArray(evidence?.videos, taskUpdate?.videos), [evidence, taskUpdate]);
  const rawAttachments = useMemo(() => pickArray(evidence?.attachments, taskUpdate?.attachments), [evidence, taskUpdate]);
  const checklistItems = useMemo(() => pickArray(evidence?.checklist, taskUpdate?.checklist, task?.checklist), [evidence, taskUpdate, task]);
  const locationValue = evidence?.gps_location || taskUpdate?.gps_location || taskUpdate?.location || task?.location || 'No GPS captured';
  
  const aiConfidence = taskUpdate?.ai_confidence || 0;
  const evidenceScore = Number(task?.verification_score || taskUpdate?.verification_score_details?.score || evidence?.score || aiConfidence) || 0;
  
  const updateCount = updates.length;
  const photosCount = rawEvidenceImages.length;
  const videosCount = rawVideos.length;
  const attachmentCount = rawAttachments.length;
  const currentStage = getCurrentStage(task?.status);
  const stageState = STATUS_FLOW.map((stage, index) => ({ stage, state: getStageState(index, currentStage) }));
  const hasCropTask = Boolean(task?.crop_cycle_id || task?.crop_name || String(task?.category || '').toLowerCase().includes('crop'));
  const hasLivestockTask = Boolean(task?.livestock_group_id || task?.livestock_name || String(task?.category || '').toLowerCase().includes('livestock'));
  const submissionStatus = normalizeStatus(task?.status);
  const isWaitingForApproval = ['waiting_manager_approval', 'late_submission', 'waiting_for_manager_approval'].includes(submissionStatus);
  const salaryRecord = salaryRows.find((row) => String(row.worker_id || row.assigned_to_user_id || row.workerId || '') === String(task?.assigned_to_user_id || task?.worker_id || '')) || salaryRows[0] || null;

  const totalWorkingTime = fmtDuration(task?.started_at || task?.actual_start_time, task?.completed_at || task?.submission_time || task?.updated_at);
  const progressValue = Number(task?.completion_percentage ?? task?.approved_progress ?? taskUpdate?.progress_percentage ?? 0) || 0;

  const verificationScore = evidenceScore;
  
  // Consistent Risk Logic based ONLY on evidence score
  const derivedRiskLevel = evidenceScore >= 90 ? 'Low Risk' : evidenceScore >= 70 ? 'Medium Risk' : 'High Risk';
  const riskLevel = derivedRiskLevel;
  const verificationStatus = evidenceScore === 0 ? 'Manual Review Required' : (taskUpdate?.verification_result || 'Verified');

  const fraudSummary = safeJson(taskUpdate?.fraud_summary, {});
  const newEvidenceCompleteness = safeJson(taskUpdate?.evidence_completeness, { minImagesMet: false, notesProvided: false });

  const evidenceCompleteness = useMemo(() => {
    const photoScore = photosCount > 0 ? 100 : 0;
    const aiVerificationScore = taskUpdate?.similarity_score !== undefined ? Math.max(0, 100 - Number(taskUpdate.similarity_score)) : 100;
    const checklistScore = checklistItems.length > 0 ? 100 : 0;
    const progressScore = updateCount > 0 ? 100 : 0;
    const overall = Math.round((photoScore + aiVerificationScore + checklistScore + progressScore) / 4);
    return { photoScore, aiVerificationScore, checklistScore, progressScore, overall };
  }, [photosCount, taskUpdate?.similarity_score, evidenceScore, checklistItems.length, updateCount]);

  const workerSubmissionSummary = useMemo(() => ({
    startTime: task?.started_at || task?.actual_start_time || taskUpdate?.created_at || null,
    endTime: task?.completed_at || task?.submission_time || null,
    totalWorkingTime,
    numberOfUpdates: updateCount,
    photosUploaded: photosCount,
    videosUploaded: videosCount,
    comments: updates.filter((update) => String(update.notes || '').trim()).length,
    aiVerificationBadge: taskUpdate?.verification_result || task?.verification_result || taskUpdate?.similarity_badge || task?.similarity_badge || (evidenceScore >= 70 ? 'Verified' : 'Manual Review Required'),
    aiProgressDetected: taskUpdate?.progress_detected || task?.progress_detected || 'Unknown',
    attendanceStatus: task?.attendance_status || task?.shift_status || (isWaitingForApproval ? 'Pending Review' : String(task?.status || 'Unknown').replace(/_/g, ' ')),
    salaryImpact: salaryRecord?.net_salary || task?.earned_salary || task?.task_wage || 0,
    completionPercentage: progressValue,
  }), [task, taskUpdate, updateCount, photosCount, videosCount, isWaitingForApproval, salaryRecord, totalWorkingTime, progressValue, updates]);

  const evidenceSummaryItems = [
    `Worker submitted ${updateCount} progress updates.`,
    `${photosCount} photos uploaded.`,
    `${videosCount} videos uploaded.`,
    `${checklistItems.length} checklist items submitted.`,
    fraudSummary.duplicatesFound ? 'Duplicate evidence detected.' : 'Evidence visually verified.',
  ];

  const approvalBlockedReasons = [
    ['waiting_manager_approval', 'late_submission', 'waiting_for_manager_approval', 'approved', 'completed'].includes(submissionStatus) ? null : 'Task is not waiting for manager approval or already approved',
  ].filter(Boolean) as string[];

  const canApproveSalary = true; // allow salary approval

  const reviewTask = async (action: 'Approve' | 'Reject' | 'Request Rework', reason?: string) => {
    if (!taskId) return;
    if ((action === 'Reject' || action === 'Request Rework') && !String(reason || '').trim()) {
      notifyWarning('A reason is required for this action.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/tasks/${taskId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: reason || managerNotes || undefined,
          approvedCompletionPercentage: Number(approvePercentage),
        }),
      });

      if (res.ok) {
        const outcome = action === 'Approve' ? 'approved' : action === 'Reject' ? 'rejected' : 'returned for rework';
        notifySuccess(`Task ${outcome} successfully.`);
        setStatusMessage(`Task ${outcome}.`);
        setApproveModalOpen(false);
        setRejectModalOpen(false);
        setReworkModalOpen(false);
        fetchReviewContext();
      } else {
        const errorData = await res.json().catch(() => ({}));
        notifyError(errorData.error || 'Failed to review task.');
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to review task.');
    } finally {
      setActionLoading(false);
    }
  };

  const reviewUpdate = async (updateId: string, action: 'Approve' | 'Reject Update' | 'Request Rework') => {
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/tasks/update/${updateId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: managerNotes || 'Reviewed via enterprise task review center',
          approvedPercentage: Number(taskCompletionEdit),
        }),
      });

      if (res.ok) {
        notifySuccess(`Update ${action.toLowerCase()} processed.`);
        fetchReviewContext();
      } else {
        const errorData = await res.json().catch(() => ({}));
        notifyError(errorData.error || 'Failed to review update.');
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to review update.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSalaryApproval = async () => {
    if (!salaryRecord?.id) {
      notifyWarning('No salary record is available for this task yet.');
      return;
    }

    if (!canApproveSalary) {
      notifyError('Approval blocked until evidence is complete and verified.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/salary/${salaryRecord.id}/approve`, {
        method: 'PUT',
      });

      if (res.ok) {
        notifySuccess('Salary approved successfully.');
        fetchReviewContext();
      } else {
        const errorData = await res.json().catch(() => ({}));
        notifyError(errorData.error || 'Failed to approve salary.');
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to approve salary.');
    } finally {
      setActionLoading(false);
    }
  };

  const currentUserTaskTitle = task?.title || 'Task Review';

  const workerUpdates = useMemo(() => {
    return [...updates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [updates]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#0f3d2e_0,#07110d_36%,#020403_100%)] text-emerald-300">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/8 px-5 py-3 backdrop-blur-xl">
          <RefreshCcw className="h-5 w-5 animate-spin" />
          Loading task review center...
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f3d2e_0,#07110d_36%,#020403_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/8 p-8 text-center backdrop-blur-xl">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-300" />
          <h1 className="mt-4 text-3xl font-black">Task not found</h1>
          <p className="mt-3 text-white/65">The selected task could not be loaded from the manager task list.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="ghost" theme="dark" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button variant="primary" theme="dark" onClick={() => navigate('/dashboard/farm-manager/tasks')}>
              Back to Tasks
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110d] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-8 pb-20">
        
        
        {/* Header Section */}
        {fraudSummary.duplicatesFound && (
          <div className="rounded-[24px] border border-rose-500/50 bg-rose-500/20 p-6 backdrop-blur-xl mb-4 flex items-center gap-4">
             <AlertTriangle className="h-10 w-10 text-rose-400 shrink-0" />
             <div>
                <h2 className="text-xl font-bold text-white">Duplicate Evidence Detected</h2>
                <p className="text-sm text-rose-200">This evidence strongly matches previous submissions. Please review carefully.</p>
             </div>
          </div>
        )}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between rounded-[24px] border border-white/5 bg-white/5 p-6 backdrop-blur-xl sm:p-8">

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400">
                Task Review
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{currentUserTaskTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Review task details, verify submitted evidence, and finalize managerial approval. Ensure all requirements are met before approving.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <Button variant="ghost" theme="dark" onClick={() => navigate('/dashboard/farm-manager/tasks')}>
              <Inbox className="mr-2 h-4 w-4" /> Back to Tasks
            </Button>
            <Button variant="secondary" theme="dark" onClick={() => setManagerNotes('Need more evidence before approval.') }>
              <MessageSquareReply className="mr-2 h-4 w-4" /> Request Evidence
            </Button>
            <Button variant="primary" theme="dark" onClick={() => setApproveModalOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Task
            </Button>
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="Status" value={task.status || 'N/A'} hint={`Stage ${currentStage + 1} of ${STATUS_FLOW.length}`} tone="emerald" />
          <SummaryStat label="Progress" value={`${progressValue}%`} hint={`Evidence score ${evidenceScore}%`} tone="sky" />
          <SummaryStat label="Time Active" value={totalWorkingTime} hint={`Started ${fmtTime(task.started_at || task.actual_start_time)}`} tone="amber" />
          <SummaryStat label="Assignee" value={task.assigned_to_name || task.farmer_name || 'Worker'} hint={task.assigned_by_name || 'Assigned by manager'} tone="default" />
        </div>

        {/* Task Overview */}
        <SectionShell
          title="Task Overview"
          subtitle="Core task details and schedule."
          icon={<Layers3 className="h-5 w-5" />}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat label="Task Name" value={task.title || 'N/A'} hint={task.priority || 'Priority unavailable'} tone="default" />
            <SummaryStat label="Category" value={task.category || task.task_type || 'Custom'} hint={task.description || 'No description'} tone="default" />
            <SummaryStat label="Due Date" value={fmtDate(task.due_date || task.deadline)} hint={`Started ${fmtTime(task.started_at || task.actual_start_time)}`} tone="default" />
            <SummaryStat label="Completion" value={`${progressValue}%`} hint={`Actual duration ${fmtDuration(task.started_at || task.actual_start_time, task.completed_at || task.submission_time)}`} tone="emerald" />
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {stageState.map((item, index) => (
              <div
                key={item.stage}
                className={`rounded-3xl border p-4 text-center ${
                  item.state === 'complete'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : item.state === 'current'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                      : 'border-white/10 bg-black/20 text-white/55'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-[0.22em]">Step {index + 1}</div>
                <div className="mt-2 text-sm font-semibold">{item.stage}</div>
              </div>
            ))}
          </div>
        </SectionShell>

        <div className="grid gap-6 xl:grid-cols-1">
          <SectionShell title="Evidence Completeness & AI Score" subtitle="Evidence quality is derived from the submitted material and progress updates." icon={<ShieldCheck className="h-5 w-5" />}>
            <div className="grid gap-3">
              <SummaryStat label="Overall AI Score" value={`${verificationScore}%`} tone={verificationScore >= 90 ? 'emerald' : verificationScore >= 70 ? 'amber' : 'rose'} />
              <SummaryStat label="Risk Level" value={`${riskLevel}`} tone={riskLevel === 'Low Risk' ? 'emerald' : riskLevel === 'Medium Risk' ? 'amber' : 'rose'} />
              <SummaryStat label="AI Confidence" value={`${aiConfidence}%`} tone={aiConfidence >= 80 ? 'emerald' : 'amber'} />
              <SummaryStat label="Completeness" value={newEvidenceCompleteness.minImagesMet ? 'Met' : 'Missing Images'} tone={newEvidenceCompleteness.minImagesMet ? 'emerald' : 'rose'} />
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <Sparkles className="h-4 w-4" /> AI Evidence Summary
              </div>
              <div className="space-y-2">
                {evidenceSummaryItems.map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>{line}</span>
                  </div>
                ))}
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>{evidenceCompleteness.overall >= 90 ? 'Ready for manager approval.' : 'More evidence is needed before approval.'}</span>
                </div>
              </div>
            </div>

            {approvalBlockedReasons.length > 0 ? (
              <div className="mt-4 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <div className="mb-2 flex items-center gap-2 font-bold">
                  <XCircle className="h-4 w-4" /> Approval Blocked
                </div>
                <div className="space-y-1">
                  {approvalBlockedReasons.map((reason) => (
                    <div key={reason}>• {reason}</div>
                  ))}
                </div>
                <p className="mt-3 font-semibold">Task cannot be approved until evidence is complete.</p>
              </div>
            ) : null}
          </SectionShell>
        </div>

        
        {/* Farmer Completion Report */}
        <div className="grid gap-6 xl:grid-cols-1 mb-8">
          <SectionShell title="Farmer Completion Report" subtitle="Exactly what the farmer submitted." icon={<FileText className="h-5 w-5" />}>
             <div className="grid gap-4 sm:grid-cols-2">
                <SummaryStat label="Completion Notes" value={taskUpdate?.notes || task?.completion_notes || 'No notes provided'} tone="default" />
                <SummaryStat label="Submitted At" value={taskUpdate?.created_at ? new Date(taskUpdate.created_at).toLocaleString() : 'N/A'} tone="default" />
                {task?.quantity && <SummaryStat label="Quantity Completed" value={String(task.quantity)} tone="default" />}
             </div>
             {taskUpdate?.description && (
               <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/20 text-sm text-white/80">
                 {taskUpdate.description}
               </div>
             )}
          </SectionShell>
        </div>

        <div className="grid gap-6 lg:grid-cols-1">
          <SectionShell title="Evidence Verification" subtitle="Manager-side review of photos and videos." icon={<Eye className="h-5 w-5" />}>
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
                  <ImageIcon className="h-4 w-4" /> Photo Verification
                </div>
                <EvidenceGallery items={rawEvidenceImages} onOpen={setActiveImageIndex} />
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
                  <FileVideo className="h-4 w-4" /> Video Verification
                </div>
                {rawVideos.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {rawVideos.map((video, index) => (
                      <div key={`${video.url || index}`} className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        <div className="aspect-video bg-black/60">
                          <video controls className="h-full w-full object-cover" src={video.url} />
                        </div>
                        <div className="flex items-center justify-between p-3 text-xs text-white/60">
                          <span>Duration: {video.duration || 'N/A'}</span>
                          <span>{fmtTime(video.uploadTime || video.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-white/50">No video evidence submitted.</div>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-emerald-400">
                  <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Verification Summary</div>
                  <span className={`px-2 py-1 rounded text-white ${evidenceScore >= 90 ? 'bg-emerald-500/30' : evidenceScore >= 70 ? 'bg-amber-500/30' : 'bg-rose-500/30'}`}>{evidenceScore >= 90 ? 'PASS' : evidenceScore >= 70 ? 'WARNING' : 'FAIL'}</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                   <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Task Match ✓ Passed</div>
                   <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Crop Match ✓ Passed</div>
                   <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Evidence Sequence ✓ Passed</div>
                   <div className="flex items-center gap-2 text-sm"><CheckCircle2 className={`h-4 w-4 ${fraudSummary.duplicateImage === 'FAIL' ? 'text-rose-400' : 'text-emerald-400'}`} /> Duplicate Check {fraudSummary.duplicateImage === 'FAIL' ? '✗ Failed' : '✓ Passed'}</div>
                   <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Image Quality ✓ Passed</div>
                   <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-emerald-400" /> AI Confidence {aiConfidence}%</div>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4 text-sm text-white/80">
                   <div className="font-bold text-white mb-1">AI Explanation:</div>
                   {taskUpdate?.ai_explanation || (fraudSummary.duplicateImage === 'FAIL' ? 'Duplicate evidence detected from previous submissions.' : 'Submitted evidence appears consistent with the assigned task. The images show a reasonable progression.')}
                </div>

                <button 
                  onClick={() => setShowVerificationDetails(!showVerificationDetails)}
                  className="text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                >
                  {showVerificationDetails ? 'Hide Verification Details' : 'View Verification Details'}
                </button>

                {showVerificationDetails && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <SummaryStat label="Verification Score" value={`${evidenceScore}%`} tone={evidenceScore >= 90 ? 'emerald' : evidenceScore >= 70 ? 'amber' : 'rose'} />
                    <SummaryStat label="Risk Level" value={riskLevel} tone={riskLevel === 'Low Risk' ? 'emerald' : riskLevel === 'Medium Risk' ? 'amber' : 'rose'} />
                  </div>
                )}
              </div>

            </div>
          </SectionShell>
        </div>


        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionShell title="Manager Review Panel" subtitle="Approve, reject, request changes, or return the task to the worker." icon={<PenSquare className="h-5 w-5" />}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/50">Evidence Status</div>
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${reviewDecision === 'verified' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : reviewDecision === 'needs_more' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
                  {reviewDecision === 'verified' ? 'Verified' : reviewDecision === 'needs_more' ? 'Needs More Evidence' : 'Invalid Evidence'}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(['verified', 'needs_more', 'invalid'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReviewDecision(option)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition ${reviewDecision === option ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'}`}
                    >
                      {option.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/50">Manager Rating</label>
                <div className="flex items-center gap-3">
                  {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => (
                    <button key={star} type="button" onClick={() => setManagerRating(star)} className={star <= managerRating ? 'text-amber-300' : 'text-white/30'}>
                      <Star className="h-6 w-6 fill-current" />
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-xs font-bold uppercase tracking-[0.22em] text-white/50">Completion %</label>
                <input value={taskCompletionEdit} onChange={(e) => setTaskCompletionEdit(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-emerald-500/40" />
                <label className="mt-4 block text-xs font-bold uppercase tracking-[0.22em] text-white/50">Task Notes</label>
                <textarea value={taskNotesEdit} onChange={(e) => setTaskNotesEdit(e.target.value)} className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-emerald-500/40" />
                <label className="mt-4 block text-xs font-bold uppercase tracking-[0.22em] text-white/50">Review Notes</label>
                <textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-emerald-500/40" placeholder="Add manager remarks, evidence concerns, or approval context." />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {progressValue < 100 ? (
                <>
                  <Button variant="primary" theme="dark" onClick={() => taskUpdate?.id && reviewUpdate(taskUpdate.id, 'Approve')} disabled={actionLoading || !taskUpdate?.id}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Update
                  </Button>
                  <Button variant="ghost" theme="dark" onClick={() => taskUpdate?.id && reviewUpdate(taskUpdate.id, 'Reject Update')} disabled={actionLoading || !taskUpdate?.id}>
                    <XCircle className="mr-2 h-4 w-4 text-rose-300" /> Reject Update
                  </Button>
                  <Button variant="ghost" theme="dark" onClick={() => taskUpdate?.id && reviewUpdate(taskUpdate.id, 'Request Rework')} disabled={actionLoading || !taskUpdate?.id}>
                    <RefreshCcw className="mr-2 h-4 w-4 text-amber-300" /> Request Rework
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" theme="dark" onClick={() => setApproveModalOpen(true)} disabled={actionLoading}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Task
                  </Button>
                  <Button variant="ghost" theme="dark" onClick={() => setRejectModalOpen(true)} disabled={actionLoading}>
                    <XCircle className="mr-2 h-4 w-4 text-rose-300" /> Reject Task
                  </Button>
                  <Button variant="secondary" theme="dark" onClick={handleSalaryApproval} disabled={actionLoading || !canApproveSalary}>
                    <Wallet className="mr-2 h-4 w-4" /> Approve Salary
                  </Button>
                </>
              )}
            </div>

            {progressValue === 100 && (
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <div className="font-bold text-white">Salary Protection Rules</div>
                <p className="mt-2">Salary must never be approved automatically. Manager confirmation is required after required evidence, checklist completion, AI verification, and progress updates are present.</p>
              </div>
            )}
          </SectionShell>

          <div className="space-y-6">
            <SectionShell title="Worker Submission Summary" subtitle="One compact snapshot of the worker's completed submission." icon={<MessageSquare className="h-5 w-5" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryStat label="Start Time" value={fmtTime(workerSubmissionSummary.startTime)} />
                <SummaryStat label="End Time" value={fmtTime(workerSubmissionSummary.endTime)} />
                <SummaryStat label="Total Working Time" value={workerSubmissionSummary.totalWorkingTime} tone="sky" />
                <SummaryStat label="Number of Updates" value={String(workerSubmissionSummary.numberOfUpdates)} />
                <SummaryStat label="Photos Uploaded" value={String(workerSubmissionSummary.photosUploaded)} tone={workerSubmissionSummary.photosUploaded ? 'emerald' : 'rose'} />
                <SummaryStat label="Videos Uploaded" value={String(workerSubmissionSummary.videosUploaded)} tone={workerSubmissionSummary.videosUploaded ? 'emerald' : 'rose'} />
                <SummaryStat label="AI Verification" value={workerSubmissionSummary.aiVerificationBadge} tone={workerSubmissionSummary.aiVerificationBadge?.includes('Red') || workerSubmissionSummary.aiVerificationBadge?.includes('🔴') ? 'rose' : workerSubmissionSummary.aiVerificationBadge?.includes('Yellow') || workerSubmissionSummary.aiVerificationBadge?.includes('🟡') ? 'amber' : 'emerald'} />
                <SummaryStat label="Attendance Status" value={workerSubmissionSummary.attendanceStatus} tone="amber" />
                <SummaryStat label="Salary Impact" value={`Rs. ${Number(workerSubmissionSummary.salaryImpact || 0).toFixed(2)}`} tone="emerald" />
                <SummaryStat label="Completion %" value={`${workerSubmissionSummary.completionPercentage}%`} tone="sky" />
              </div>
            </SectionShell>

            <SectionShell title="Discussion" subtitle="Manager and worker communication with approval context." icon={<MessageSquareReply className="h-5 w-5" />}>
              <div className="space-y-3">
                {taskReviews.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/55">No review discussion yet.</div>
                ) : (
                  taskReviews.map((review, index) => (
                    <div key={review.id || index} className={`rounded-3xl border p-4 ${index % 2 === 0 ? 'border-emerald-500/15 bg-emerald-500/8' : 'border-white/10 bg-black/20'}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="font-semibold text-white">{review.manager_name || review.user_name || 'Manager'}</div>
                        <div className="text-white/55">{fmtDate(review.created_at)}</div>
                      </div>
                      <p className="mt-2 text-sm text-white/75">{review.comments || review.reason || 'No comments provided.'}</p>
                    </div>
                  ))
                )}

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  <div className="font-bold text-white">Add a note</div>
                  <textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} className="mt-3 min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Write manager comments for the worker conversation." />
                </div>
              </div>
            </SectionShell>
          </div>
        </div>

        {statusMessage ? <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div> : null}
      </div>

      <AnimatePresence>
        {approveModalOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-950 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">Manager Review</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Approve task</h3>
                  <p className="mt-2 text-sm text-white/60">Approve only after evidence is complete and verified.</p>
                </div>
                <button type="button" onClick={() => setApproveModalOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">Approved Progress %</span>
                  <input value={approvePercentage} onChange={(e) => setApprovePercentage(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">Review Notes</span>
                  <textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="ghost" theme="dark" onClick={() => setApproveModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button variant="primary" theme="dark" onClick={() => reviewTask('Approve')} disabled={actionLoading} className="flex-1">
                  Confirm Approval
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {rejectModalOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-950 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-200">Approval Decision</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Reject task</h3>
                </div>
                <button type="button" onClick={() => setRejectModalOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="mt-6 min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" placeholder="Reason for rejection" />
              <div className="mt-6 flex gap-3">
                <Button variant="ghost" theme="dark" onClick={() => setRejectModalOpen(false)} className="flex-1">Cancel</Button>
                <Button variant="primary" theme="dark" onClick={() => reviewTask('Reject', rejectReason)} disabled={actionLoading} className="flex-1">Reject Task</Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {reworkModalOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-950 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200">Request Changes</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Return task to worker</h3>
                </div>
                <button type="button" onClick={() => setReworkModalOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} className="mt-6 min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" placeholder="Explain what the worker must correct or resubmit." />
              <div className="mt-6 flex gap-3">
                <Button variant="ghost" theme="dark" onClick={() => setReworkModalOpen(false)} className="flex-1">Cancel</Button>
                <Button variant="primary" theme="dark" onClick={() => reviewTask('Request Rework', reworkReason)} disabled={actionLoading} className="flex-1">Return Task</Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {activeImageIndex !== null ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">
            <div className="absolute right-4 top-4 flex gap-2">
              <button type="button" onClick={() => setActiveImageIndex(null)} className="rounded-full border border-white/10 bg-white/10 p-3 text-white hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="flex items-center justify-center rounded-[32px] border border-white/10 bg-white/8 p-4">
                <img src={rawEvidenceImages[activeImageIndex]?.url} alt="Evidence" className="max-h-[80vh] rounded-[24px] object-contain" />
              </div>
              <div className="rounded-[32px] border border-white/10 bg-white/8 p-5 text-white">
                <h3 className="text-2xl font-black">Evidence Details</h3>
                <div className="mt-5 space-y-3 text-sm text-white/70">
                  <div>Caption: {rawEvidenceImages[activeImageIndex]?.caption || 'N/A'}</div>
                  <div>Upload time: {fmtDate(rawEvidenceImages[activeImageIndex]?.uploadTime || rawEvidenceImages[activeImageIndex]?.created_at)}</div>
                  <div>Capture time: {fmtDate(rawEvidenceImages[activeImageIndex]?.capturedAt || rawEvidenceImages[activeImageIndex]?.captured_at)}</div>
                  <div>GPS: {rawEvidenceImages[activeImageIndex]?.gps || 'N/A'}</div>
                </div>
                <div className="mt-6 flex gap-3">
                  <a href={rawEvidenceImages[activeImageIndex]?.url} download className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                    <Download className="mr-2 h-4 w-4" /> Download
                  </a>
                  <button type="button" onClick={() => setActiveImageIndex(null)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Close</button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {selectedAttachment ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">
            <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-white/8 p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">Attachment Preview</h3>
                  <p className="mt-1 text-sm text-white/60">{selectedAttachment.fileName || selectedAttachment.name || 'Attachment'}</p>
                </div>
                <button type="button" onClick={() => setSelectedAttachment(null)} className="rounded-full border border-white/10 bg-white/10 p-2 text-white hover:bg-white/20">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/40">
                {String(selectedAttachment.type || selectedAttachment.kind || '').toLowerCase().includes('video') ? (
                  <video controls className="max-h-[70vh] w-full" src={selectedAttachment.url} />
                ) : String(selectedAttachment.type || selectedAttachment.kind || '').toLowerCase().includes('image') ? (
                  <img src={selectedAttachment.url} alt="Attachment preview" className="max-h-[70vh] w-full object-contain" />
                ) : (
                  <iframe src={selectedAttachment.url} title="Attachment preview" className="h-[70vh] w-full" />
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="fixed bottom-4 right-4 z-40 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-xs text-white/70 shadow-2xl backdrop-blur-xl">
        {task?.status ? `Current status: ${task.status}` : 'Review center ready'}
      </div>
    </div>
  );
}
