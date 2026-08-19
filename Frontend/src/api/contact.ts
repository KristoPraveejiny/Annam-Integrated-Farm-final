import { apiFetch } from '../utils/apiFetch';

export type ContactStatus = 'new' | 'contacted' | 'resolved' | 'closed';

export type ContactMessage = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
  reply_count?: number;
  last_replied_at?: string | null;
};

export type ContactReply = {
  id: string;
  reply_message: string;
  email_sent: boolean;
  created_at: string;
  replied_by_name?: string | null;
};

export type ContactCounts = {
  total: number;
  new: number;
  contacted: number;
  resolved: number;
  closed: number;
};

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

export async function getContactMessages(params: { status?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.search?.trim()) query.set('search', params.search.trim());

  const res = await apiFetch(`/api/contact${query.toString() ? `?${query.toString()}` : ''}`);
  return parse(res) as Promise<{ messages: ContactMessage[]; counts: ContactCounts }>;
}

export async function getContactMessageById(id: string) {
  const res = await apiFetch(`/api/contact/${id}`);
  return parse(res) as Promise<ContactMessage & { replies: ContactReply[] }>;
}

export async function updateContactMessageStatus(id: string, status: ContactStatus) {
  const res = await apiFetch(`/api/contact/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parse(res);
}

export async function replyToContactMessage(id: string, replyMessage: string) {
  const res = await apiFetch(`/api/contact/${id}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyMessage }),
  });
  return parse(res);
}

export async function deleteContactMessage(id: string) {
  const res = await apiFetch(`/api/contact/${id}`, { method: 'DELETE' });
  return parse(res);
}
