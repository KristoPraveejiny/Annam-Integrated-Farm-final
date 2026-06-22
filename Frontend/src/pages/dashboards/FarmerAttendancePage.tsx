import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiCalendar } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface Attendance {
  id: string;
  task_title: string;
  date: string;
  session: string;
  attendance_status: string;
}

export default function FarmerAttendancePage() {
  const { t } = useTranslation();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        
        const res = await fetch('/api/salary/my-earnings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setAttendances(data.attendances || []);
      } catch (err) {
        console.error('Failed to fetch attendance history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);
  return (
    <div className="space-y-6 pb-20">
      <SectionHeading eyebrow={t("Attendance")} title={t("Daily Attendance")} description={t("Your attendance is now automatically tracked when you start your assigned tasks.")} tone="light" />

      <Card title={t("Attendance Tracking Info")} subtitle={t("How it works")} className="!aspect-auto w-full max-w-sm self-start">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          <div className="flex items-start gap-3">
            <FiCheckCircle className="mt-1 text-xl text-emerald-400" />
            <div>
              <h4 className="mb-2 text-sm font-bold text-white sm:text-base">{t("Automatic Check-in")}</h4>
              <p className="text-xs leading-5 text-emerald-200/80 sm:text-sm sm:leading-6">
                {t("You no longer need to manually check in. Your attendance is automatically recorded the moment you begin working on an assigned task from your Task Dashboard. Simply change the task status to \"In Progress\" to record your presence for that session.")}
              </p>
            </div>
          </div>
        </div>
      </Card>
      
      <Card title={t("Attendance History")} subtitle={t("Your automatically tracked sessions")}>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl mt-4">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">{t("Date")}</th>
                <th className="px-6 py-4">{t("Task")}</th>
                <th className="px-6 py-4">{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/60">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">{t("Loading history...")}</td>
                </tr>
              ) : attendances.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    {t("No attendance records yet. Start working on a task to automatically check in.")}
                  </td>
                </tr>
              ) : (
                attendances.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                      <FiCalendar className="text-slate-400"/> {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-emerald-400">{row.task_title} ({t(row.session)})</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        row.attendance_status === 'Present' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                        row.attendance_status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>{t(row.attendance_status)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
