import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { io } from 'socket.io-client';
import { Users, Clock, AlertCircle, FileCheck, CheckCircle2, TrendingUp } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';

export default function SmartManagerDashboard() {
  const [stats, setStats] = useState({
    todayWorkforce: 0,
    inProgress: 0,
    waitingEvidence: 0,
    waitingApproval: 0,
    approvedTasks: 0,
    overdueTasks: 0,
    lateSubmissions: 0,
    missedShifts: 0,
    attendancePercentage: 0,
    avgWorkingHours: 0
  });
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    fetchStats();

    // Setup Socket
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    
    socket.on('connect', () => {
      setSocketConnected(true);
      // Depending on auth implementation, we should fetch farmId from context
      // For now, assuming server sends farm wide updates to authenticated users
    });

    socket.on('task_status_changed', (data) => {
      console.log('Real-time task update:', data);
      fetchStats(); // Re-fetch stats when a task updates to keep dashboard synced
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchStats = async () => {
    try {
      // In a real app, this would hit a new /api/dashboard/smart-workforce endpoint
      const res = await apiFetch('/api/tasks');
      if (res.ok) {
        const tasks = await res.json();
        
        // Mock computation from tasks for demo purposes. Real app would do this in backend SQL.
        setStats({
          todayWorkforce: tasks.length,
          inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
          waitingEvidence: tasks.filter((t: any) => t.status === 'work_pending_confirmation').length,
          waitingApproval: tasks.filter((t: any) => t.status === 'waiting_manager_approval').length,
          approvedTasks: tasks.filter((t: any) => t.status === 'approved').length,
          overdueTasks: tasks.filter((t: any) => t.status === 'overdue').length,
          lateSubmissions: tasks.filter((t: any) => t.status === 'late_submission').length,
          missedShifts: tasks.filter((t: any) => t.status === 'missed_shift').length,
          attendancePercentage: 92, // Mocked
          avgWorkingHours: 7.5 // Mocked
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-emerald-500">Loading Smart Dashboard...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-950 min-h-screen text-slate-200">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Smart Workforce Monitoring</h1>
          <p className="text-slate-400 mt-1">Enterprise Real-Time Dashboard</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            {socketConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            )}
          </span>
          <span className="text-sm text-slate-400">{socketConnected ? 'Live Updates Active' : 'Connecting...'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Today's Workforce" value={stats.todayWorkforce} icon={<Users />} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" />
        <MetricCard title="In Progress" value={stats.inProgress} icon={<Play />} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" />
        <MetricCard title="Waiting Evidence" value={stats.waitingEvidence} icon={<FileCheck />} color="text-yellow-400" bg="bg-yellow-500/10" border="border-yellow-500/20" />
        <MetricCard title="Waiting Approval" value={stats.waitingApproval} icon={<Clock />} color="text-orange-400" bg="bg-orange-500/10" border="border-orange-500/20" />
        
        <MetricCard title="Approved Tasks" value={stats.approvedTasks} icon={<CheckCircle2 />} color="text-green-400" bg="bg-green-500/10" border="border-green-500/20" />
        <MetricCard title="Overdue Tasks" value={stats.overdueTasks} icon={<AlertCircle />} color="text-red-400" bg="bg-red-500/10" border="border-red-500/20" />
        <MetricCard title="Late Submissions" value={stats.lateSubmissions} icon={<Clock />} color="text-orange-500" bg="bg-orange-500/10" border="border-orange-500/20" />
        <MetricCard title="Missed Shifts" value={stats.missedShifts} icon={<AlertCircle />} color="text-rose-500" bg="bg-rose-500/10" border="border-rose-500/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card title="Workforce Performance Analytics">
          <div className="flex flex-col space-y-6 py-4">
             <div className="flex items-center justify-between">
                <span className="text-slate-400">Average Attendance</span>
                <span className="text-2xl font-bold text-white">{stats.attendancePercentage}%</span>
             </div>
             <div className="w-full bg-slate-800 rounded-full h-2.5">
               <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${stats.attendancePercentage}%` }}></div>
             </div>

             <div className="flex items-center justify-between mt-4">
                <span className="text-slate-400">Average Working Hours</span>
                <span className="text-2xl font-bold text-white">{stats.avgWorkingHours} hrs/shift</span>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, bg, border }: any) {
  return (
    <div className={`p-6 rounded-2xl border ${border} ${bg} backdrop-blur-sm flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-300 font-medium">{title}</h3>
        <div className={`p-2 rounded-lg bg-slate-900/50 ${color}`}>{icon}</div>
      </div>
      <div className={`text-4xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Play(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
    )
}
