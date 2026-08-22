import { apiFetch } from '../utils/apiFetch';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveRequest {
  id: string;
  worker_id: string;
  worker_name?: string;
  worker_email?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  manager_notes?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  total_days?: number;
  conflictingTasks?: { id: string; title: string; due_date: string }[];
}

async function handle<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Request failed');
  return payload as T;
}

export async function submitLeaveRequest(body: {
  startDate: string;
  endDate: string;
  reason: string;
}) {
  return handle<LeaveRequest>(
    await apiFetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
}

export async function fetchMyLeaveRequests() {
  return handle<LeaveRequest[]>(await apiFetch('/api/leave-requests/mine'));
}

export async function cancelLeaveRequest(id: string) {
  return handle<LeaveRequest>(await apiFetch(`/api/leave-requests/${id}`, { method: 'DELETE' }));
}

export async function fetchFarmLeaveRequests(status = 'all') {
  return handle<LeaveRequest[]>(await apiFetch(`/api/leave-requests?status=${encodeURIComponent(status)}`));
}

export async function reviewLeaveRequest(id: string, status: 'Approved' | 'Rejected', managerNotes?: string) {
  return handle<LeaveRequest>(
    await apiFetch(`/api/leave-requests/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, managerNotes })
    })
  );
}

/** Dates a worker is on approved leave, used to disable them in the date picker. */
export async function fetchWorkerLeaveDates(workerId: string) {
  return handle<{ workerId: string; dates: string[] }>(
    await apiFetch(`/api/leave-requests/worker/${workerId}/dates`)
  );
}
