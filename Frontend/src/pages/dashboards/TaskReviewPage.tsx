import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, XCircle, RefreshCcw, Clock, AlertTriangle, 
  ZoomIn, Download, ChevronLeft, ChevronRight, Check, X,
  FileImage, Info, Maximize2, X as CloseIcon, TrendingUp,
  Wallet, User, Calendar, ShieldCheck
} from 'lucide-react';

export default function TaskReviewPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Gallery states
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [activeGalleryImages, setActiveGalleryImages] = useState<any[]>([]);

  // Modal states
  const [activeUpdate, setActiveUpdate] = useState<any>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  
  // Form states
  const [approvePercentage, setApprovePercentage] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [reworkInstructions, setReworkInstructions] = useState('');
  const [reworkDeadline, setReworkDeadline] = useState('');
  const [reworkRemaining, setReworkRemaining] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [taskId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const updatesRes = await apiFetch('/api/tasks/updates/recent');
      if (updatesRes.ok) {
        const updatesData = await updatesRes.json();
        const taskUpdates = updatesData.filter((u: any) => u.task_id === taskId).reverse(); 
        setUpdates(taskUpdates);
        
        if (taskUpdates.length > 0) {
          const t = taskUpdates[0];
          setTask({
             id: t.task_id,
             title: t.task_title,
             description: t.task_description,
             status: t.task_status,
             farmer_name: t.farmer_name,
             shift_id: t.shift_id,
             started_at: t.started_at,
             completed_at: t.completed_at,
             working_hours: t.working_hours,
             task_wage: t.task_wage,
             approved_progress: t.approved_progress || 0
          });
        }
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const reviewUpdate = async (updateId: string, action: string, payload: any) => {
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/tasks/update/${updateId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });

      if (res.ok) {
        notifySuccess(`Submission ${action} processed.`);
        fetchData();
        closeModals();
      } else {
        const errorData = await res.json();
        notifyError(errorData.error || 'Failed to review update');
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to review update');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = () => {
    reviewUpdate(activeUpdate.id, 'Approve', { 
      approvedPercentage: approvePercentage, 
      reason: approveNotes 
    });
  };

  const handleRework = () => {
    const combinedReason = `Reason: ${reworkReason}\nInstructions: ${reworkInstructions}\nDeadline: ${reworkDeadline}`;
    reviewUpdate(activeUpdate.id, 'Request Rework', { 
      reason: combinedReason,
      remainingPercentage: reworkRemaining
    });
  };

  const handleReject = () => {
    reviewUpdate(activeUpdate.id, 'Reject Update', { reason: rejectReason });
  };

  const closeModals = () => {
    setIsApproveModalOpen(false);
    setIsReworkModalOpen(false);
    setIsRejectModalOpen(false);
    setActiveUpdate(null);
    setApprovePercentage('');
    setApproveNotes('');
    setReworkReason('');
    setReworkInstructions('');
    setReworkDeadline('');
    setReworkRemaining('');
    setRejectReason('');
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case '🟢 Low Risk': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case '🟡 Medium Risk': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case '🔴 High Risk': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    }
  };

  const ProgressBar = ({ label, value, max = 20, tooltip }: any) => {
    const percentage = Math.round((value / max) * 100);
    return (
      <div className="mb-4" title={tooltip}>
        <div className="flex justify-between text-xs font-semibold mb-1 text-slate-300">
          <span>{label}</span>
          <span className="text-emerald-400">{percentage}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
          />
        </div>
      </div>
    );
  };

  const StatusBadge = ({ label, passed, issueText }: any) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm ${passed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      <span className="text-xs font-bold uppercase tracking-wider">{passed ? `${label}: Passed` : issueText}</span>
    </div>
  );

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-500"><RefreshCcw className="animate-spin" size={32} /></div>;
  }

  if (!task) {
    return <div className="p-8 text-center text-red-400 bg-slate-950 min-h-screen pt-24 font-bold">Task not found</div>;
  }

  const latestUpdate = updates[updates.length - 1];
  const totalValue = Number(task.task_wage || 0);
  const approvedPct = Number(task.approved_progress || 0);
  const currentPct = latestUpdate ? Number(latestUpdate.progress_percentage) : 0;
  const pendingPct = Math.max(0, currentPct - approvedPct);
  const earnedSalary = (totalValue * approvedPct) / 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 pt-24 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER PANEL */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/5 border border-white/10 backdrop-blur-md p-6 rounded-3xl">
            <h1 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
               <ShieldCheck className="text-emerald-400" /> 
               {task.title}
            </h1>
            <p className="text-slate-400 text-sm mb-6 max-w-2xl">{task.description}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <User size={16} className="text-emerald-400 mb-2" />
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Worker</p>
                <p className="font-semibold text-white truncate">{task.farmer_name}</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <Calendar size={16} className="text-emerald-400 mb-2" />
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Started</p>
                <p className="font-semibold text-white truncate">
                  {task.started_at ? new Date(task.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                </p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <TrendingUp size={16} className="text-emerald-400 mb-2" />
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Updates</p>
                <p className="font-semibold text-white">{updates.length}</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <Info size={16} className="text-emerald-400 mb-2" />
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</p>
                <p className="font-semibold text-white">{task.status}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/40 border border-emerald-500/20 backdrop-blur-md p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 mb-4">
                <Wallet size={20} />
                <h3 className="font-bold tracking-wider uppercase text-sm">Task Value Summary</h3>
              </div>
              <div className="text-4xl font-black text-white mb-6">Rs. {totalValue.toFixed(2)}</div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Completed Progress</span>
                  <span className="font-bold text-white">{currentPct}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400 font-semibold">Approved Progress</span>
                  <span className="font-bold text-emerald-400">{approvedPct}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-400 font-semibold">Pending Progress</span>
                  <span className="font-bold text-amber-400">{pendingPct}%</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-end">
               <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Salary Earned</p>
                  <p className="text-2xl font-bold text-emerald-400">Rs. {earnedSalary.toFixed(2)}</p>
               </div>
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="mt-8">
           <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
             <Clock className="text-emerald-400" />
             Activity Timeline
           </h2>
           
           <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {updates.map((update, index) => {
                 let images = [];
                 try {
                   if (typeof update.images === 'string') images = JSON.parse(update.images);
                   else if (Array.isArray(update.images)) images = update.images;
                 } catch(e) {}
                 
                 const scoreDetails = typeof update.verification_score_details === 'string' 
                   ? JSON.parse(update.verification_score_details || '{}') 
                   : (update.verification_score_details || {});
                 
                 const totalScore = Object.values(scoreDetails).reduce((a: any, b: any) => a + b, 0) as number;
                 const isPending = update.update_status === 'Waiting for Review';
                 
                 // Flags parsing
                 let flags = [];
                 try {
                    if (typeof update.suspicious_flags === 'string') flags = JSON.parse(update.suspicious_flags);
                    else if (Array.isArray(update.suspicious_flags)) flags = update.suspicious_flags;
                 } catch(e) {}

                 return (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     key={update.id} 
                     className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                   >
                     <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-950 bg-emerald-500 text-slate-950 font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                       {index + 1}
                     </div>
                     
                     <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 border border-white/10 backdrop-blur-md p-6 rounded-3xl shadow-xl transition-all hover:bg-white/10">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <div className="text-sm text-emerald-400 font-bold mb-1">
                                {new Date(update.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                              <h3 className="text-xl font-bold text-white">{update.progress_percentage}% Progress</h3>
                           </div>
                           <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                             update.update_status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                             update.update_status === 'Waiting for Review' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                             'bg-red-500/20 text-red-400 border-red-500/30'
                           }`}>
                             {update.update_status}
                           </span>
                        </div>
                        
                        <p className="text-slate-300 text-sm mb-6 bg-black/20 p-4 rounded-2xl border border-white/5 italic">
                          "{update.notes}"
                        </p>

                        {/* SMART VERIFICATION REDESIGN */}
                        <div className="bg-slate-950/50 rounded-3xl p-5 mb-6 border border-white/5">
                           <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                              <h4 className="font-black tracking-wider text-sm text-white uppercase flex items-center gap-2">
                                 <ShieldCheck size={18} className="text-emerald-400"/>
                                 Smart Verification
                              </h4>
                              <div className="flex items-center gap-4">
                                 <div className="text-right">
                                    <div className="text-2xl font-black text-white">{totalScore}%</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Score</div>
                                 </div>
                                 <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getRiskBadge(update.risk_level)}`}>
                                    {update.risk_level}
                                 </div>
                              </div>
                           </div>

                           <div className="grid lg:grid-cols-2 gap-8">
                              <div>
                                 <ProgressBar label="Image Quality" value={scoreDetails['Image Count'] || scoreDetails['Image Quality']} tooltip="Assesses amount and clarity of visual evidence" />
                                 <ProgressBar label="Notes Quality" value={scoreDetails['Notes Quality']} tooltip="Assesses detail and relevance of the written notes" />
                                 <ProgressBar label="Progress Completeness" value={scoreDetails['Progress Updates'] || scoreDetails['Work Diversity']} tooltip="Assesses the consistency of progress increments" />
                                 <ProgressBar label="Task Duration" value={scoreDetails['Task Duration']} tooltip="Assesses if the time spent aligns with the reported progress" />
                              </div>
                              <div className="space-y-3">
                                 <StatusBadge 
                                    label="Duplicate Check" 
                                    passed={scoreDetails['Duplicate Check'] === 20 || scoreDetails['Originality Check'] === 20} 
                                    issueText="Duplicate Images Detected" 
                                 />
                                 <StatusBadge 
                                    label="Metadata Validation" 
                                    passed={!flags.some(f => f.includes('identical file sizes'))} 
                                    issueText="Suspicious Metadata" 
                                 />
                                 <StatusBadge 
                                    label="Timing Integrity" 
                                    passed={scoreDetails['Task Duration'] > 0} 
                                    issueText="Rapid Update Detected" 
                                 />
                              </div>
                           </div>

                           <div className="mt-6 bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4">
                              <div className="text-xs uppercase font-bold text-emerald-400 mb-2 tracking-wider">AI Recommendation</div>
                              <p className="text-sm text-slate-300">
                                {totalScore >= 90 ? "The submitted evidence appears valid. No duplicate images detected. Task duration is reasonable. Manager approval is recommended." : 
                                 totalScore >= 75 ? "The evidence is mostly valid but contains minor warnings. Review notes and images briefly before approval." :
                                 "The evidence contains suspicious elements (duplicates or rapid updates). Manual verification is highly recommended before approval."}
                              </p>
                           </div>

                           {flags.length > 0 && (
                             <div className="mt-4 flex flex-wrap gap-2">
                               {flags.map((f: string, i: number) => (
                                 <span key={i} className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                   <AlertTriangle size={12} /> {f}
                                 </span>
                               ))}
                             </div>
                           )}
                        </div>

                        {/* EVIDENCE GALLERY */}
                        {images.length > 0 && (
                          <div>
                            <h4 className="text-xs uppercase font-bold text-slate-500 mb-3 tracking-wider flex items-center gap-2">
                              <FileImage size={14}/> Evidence Gallery ({images.length})
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                              {images.map((img: any, i: number) => (
                                <div 
                                  key={i} 
                                  onClick={() => { setActiveGalleryImages(images); setSelectedImageIndex(i); }}
                                  className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group border border-white/10"
                                >
                                  <img src={img.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                     <ZoomIn className="text-white" />
                                  </div>
                                  {img.status !== '✓' && (
                                    <div className="absolute top-0 right-0 left-0 bg-red-500/90 text-white text-[9px] font-black uppercase tracking-widest text-center py-1">
                                      {img.status}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* MANAGER DECISION PANEL */}
                        {isPending && (
                          <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap gap-3">
                             <button 
                               onClick={() => { setActiveUpdate(update); setApprovePercentage(update.progress_percentage.toString()); setIsApproveModalOpen(true); }}
                               className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
                             >
                               <Check size={18} /> Approve
                             </button>
                             <button 
                               onClick={() => { setActiveUpdate(update); setIsReworkModalOpen(true); }}
                               className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
                             >
                               <RefreshCcw size={18} /> Request Rework
                             </button>
                             <button 
                               onClick={() => { setActiveUpdate(update); setIsRejectModalOpen(true); }}
                               className="flex-1 bg-slate-800 hover:bg-red-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
                             >
                               <X size={18} /> Reject
                             </button>
                          </div>
                        )}

                     </div>
                   </motion.div>
                 );
              })}
           </div>
        </div>

      </div>

      {/* FULLSCREEN GALLERY */}
      <AnimatePresence>
        {selectedImageIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col"
          >
            <div className="flex justify-between items-center p-6 text-white border-b border-white/10">
               <div>
                  <h3 className="font-bold">Evidence Viewer</h3>
                  <p className="text-sm text-slate-400">Image {selectedImageIndex + 1} of {activeGalleryImages.length}</p>
               </div>
               <div className="flex items-center gap-4">
                  <a href={activeGalleryImages[selectedImageIndex]?.url} download className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                     <Download size={20} />
                  </a>
                  <button onClick={() => setSelectedImageIndex(null)} className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full transition-colors">
                     <CloseIcon size={20} />
                  </button>
               </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-8 relative">
               <button 
                  onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                  disabled={selectedImageIndex === 0}
                  className="absolute left-8 p-4 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
               >
                 <ChevronLeft size={32} className="text-white"/>
               </button>
               
               <motion.img 
                  key={selectedImageIndex}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={activeGalleryImages[selectedImageIndex]?.url}
                  className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
               />

               <button 
                  onClick={() => setSelectedImageIndex(Math.min(activeGalleryImages.length - 1, selectedImageIndex + 1))}
                  disabled={selectedImageIndex === activeGalleryImages.length - 1}
                  className="absolute right-8 p-4 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
               >
                 <ChevronRight size={32} className="text-white"/>
               </button>
            </div>
            
            <div className="p-6 border-t border-white/10 flex justify-center gap-8 text-sm text-slate-300">
               <div className="text-center">
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Status</div>
                  <div className="font-semibold text-emerald-400">{activeGalleryImages[selectedImageIndex]?.status || 'Valid'}</div>
               </div>
               <div className="text-center">
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Upload Time</div>
                  <div className="font-semibold text-white">{new Date(activeUpdate?.created_at || Date.now()).toLocaleString()}</div>
               </div>
               <div className="text-center">
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Size</div>
                  <div className="font-semibold text-white">{(activeGalleryImages[selectedImageIndex]?.size / 1024).toFixed(1) || 'N/A'} KB</div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <AnimatePresence>
        {isApproveModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2"><CheckCircle2 className="text-emerald-500" /> Approve Progress</h3>
              <p className="text-slate-400 mb-6 text-sm">Review and finalize the worker's progress.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Approved Percentage</label>
                  <input 
                    type="number" 
                    value={approvePercentage} 
                    onChange={e => setApprovePercentage(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Approval Notes (Optional)</label>
                  <textarea 
                    value={approveNotes} 
                    onChange={e => setApproveNotes(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors h-24"
                    placeholder="e.g. Great work on the western sector."
                  />
                </div>
                
                <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-4 flex justify-between items-center">
                   <div>
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Salary Preview</p>
                      <p className="text-2xl font-black text-white">Rs. {((totalValue * (Number(approvePercentage)||0)) / 100).toFixed(2)}</p>
                   </div>
                   <Wallet className="text-emerald-500/50" size={32} />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={closeModals} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-colors">Cancel</button>
                <button onClick={handleApprove} disabled={actionLoading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white transition-colors">Confirm Approval</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isReworkModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2"><RefreshCcw className="text-amber-500" /> Request Rework</h3>
              <p className="text-slate-400 mb-6 text-sm">Send instructions to the worker to fix issues.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reason for Rework</label>
                  <input type="text" value={reworkReason} onChange={e => setReworkReason(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Instructions</label>
                  <textarea value={reworkInstructions} onChange={e => setReworkInstructions(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white h-24" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Deadline</label>
                     <input type="text" placeholder="e.g. Tomorrow 5 PM" value={reworkDeadline} onChange={e => setReworkDeadline(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Remaining %</label>
                     <input type="number" value={reworkRemaining} onChange={e => setReworkRemaining(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white" />
                   </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={closeModals} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-colors">Cancel</button>
                <button onClick={handleRework} disabled={actionLoading || !reworkReason} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-white transition-colors disabled:opacity-50">Send Request</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isRejectModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2"><XCircle className="text-red-500" /> Reject Submission</h3>
              <p className="text-slate-400 mb-6 text-sm">This rejects only the current submission. The task remains open.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rejection Reason</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white h-24" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={closeModals} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-colors">Cancel</button>
                <button onClick={handleReject} disabled={actionLoading || !rejectReason} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white transition-colors disabled:opacity-50">Reject Update</button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
