import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { useSocket } from '../../hooks/useSocket';
import { notifyError } from '../../utils/notifications';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import ManagerReviewPanel from '../../components/workforce/ManagerReviewPanel';
import { ShieldCheck, Clock, CheckCircle2, User, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FarmManagerWorkforcePage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // We could get userId from context or jwt decode. Assuming a mock ID or fetch from API
  // Using generic 'farm_manager' role for now, ideally decoded from JWT.
  const userId = '1'; // Placeholder, useSocket will connect.

  const socket = useSocket(userId);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('task_status_changed', (data) => {
      console.log('Real-time update:', data);
      setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: data.status } : t));
      if (selectedTask && selectedTask.id === data.taskId) {
        setSelectedTask((prev: any) => ({ ...prev, status: data.status }));
      }
    });

    return () => {
      socket.off('task_status_changed');
    };
  }, [socket, selectedTask]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/tasks/manager');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
      notifyError('Failed to fetch tasks.');
    } finally {
      setLoading(false);
    }
  };

  const pendingReviews = tasks.filter(t => t.status === 'waiting_manager_approval' || t.status === 'late_submission');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  
  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto p-4 md:p-8 pt-24 min-h-screen bg-slate-950 text-slate-200">
      <SectionHeading 
        eyebrow="Smart Workforce" 
        title="Live Dashboard" 
        description="Monitor tasks in real-time, review evidence, and manage your workforce."
        tone="light" 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card title="Live Overview">
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-3 text-emerald-400">
                  <Activity size={24} />
                  <span className="font-semibold">In Progress</span>
                </div>
                <span className="text-2xl font-bold text-emerald-400">{inProgress.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <div className="flex items-center gap-3 text-orange-400">
                  <Clock size={24} />
                  <span className="font-semibold">Needs Review</span>
                </div>
                <span className="text-2xl font-bold text-orange-400">{pendingReviews.length}</span>
              </div>
            </div>
          </Card>

          <Card title="Task List">
            <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {tasks.length === 0 ? (
                <p className="text-slate-400 text-sm">No tasks found.</p>
              ) : (
                tasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedTask?.id === task.id ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/50 border-white/5 hover:border-white/20'}`}
                  >
                    <h4 className="font-semibold text-white mb-1">{task.title}</h4>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1"><User size={12} /> {task.assigned_to_name || 'Unassigned'}</span>
                      <span className={`px-2 py-1 rounded-full capitalize ${
                        task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                        task.status === 'waiting_manager_approval' ? 'bg-orange-500/20 text-orange-400' :
                        task.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedTask ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTask.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="text-emerald-500" />
                        {selectedTask.title}
                      </h2>
                      <p className="text-slate-400 mt-2">{selectedTask.description}</p>
                    </div>
                    <span className="px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-300 border border-white/10 uppercase tracking-wider font-semibold">
                      {selectedTask.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 text-sm">
                    <div>
                      <div className="text-slate-500 mb-1">Assigned To</div>
                      <div className="text-white font-medium">{selectedTask.assigned_to_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Start Time</div>
                      <div className="text-white font-medium">{selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString() : 'Not started'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Shift End</div>
                      <div className="text-white font-medium">{selectedTask.shift_end_time ? new Date(selectedTask.shift_end_time).toLocaleTimeString() : 'N/A'}</div>
                    </div>
                  </div>
                </Card>

                {['waiting_manager_approval', 'late_submission'].includes(selectedTask.status) ? (
                  <ManagerReviewPanel task={selectedTask} onReviewComplete={fetchTasks} />
                ) : selectedTask.status === 'approved' ? (
                  <Card>
                    <div className="p-8 text-center text-emerald-400">
                      <CheckCircle2 size={48} className="mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">Task Approved</h3>
                      <p className="text-slate-400 max-w-md mx-auto">This task has been reviewed and approved. Attendance has been marked and payroll updated.</p>
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <div className="p-8 text-center text-slate-400">
                      <Activity size={48} className="mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-white mb-2">Task Not Ready For Review</h3>
                      <p className="max-w-md mx-auto">This task is currently {selectedTask.status.replace(/_/g, ' ')}. Waiting for the worker to submit evidence.</p>
                    </div>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <Card>
              <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
                <ShieldCheck size={48} className="mb-4 opacity-50" />
                <p>Select a task from the list to view details and review.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
