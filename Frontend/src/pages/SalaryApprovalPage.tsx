import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';

interface Attendance {
  id: string;
  worker_name: string;
  task_title: string;
  date: string;
  session: string;
  status: string;
  payment_amount: number;
}

export default function SalaryApprovalPage() {
  const [pending, setPending] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch('/api/salary/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPending(data);
    } catch (err) {
      console.error('Failed to fetch pending attendances', err);
    } finally {
      setLoading(false);
    }
  };

  const approveSession = async (id: string) => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      await fetch(`/api/salary/approve/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPending(pending.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to approve', err);
    }
  };

  return (
    <div className="section-shell py-10">
      <SectionHeading 
        eyebrow="Manager" 
        title="Salary Approval" 
        description="Review and approve task sessions completed by workers." 
        tone="light" 
      />

      <Card title="Pending Approvals" subtitle="Worker task sessions awaiting approval">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-slate-500">No pending sessions.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pending.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.worker_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.task_title}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{item.session}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">Rs. {item.payment_amount}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => approveSession(item.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
