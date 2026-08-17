import { apiFetch } from '../utils/apiFetch';

export type FeedRequirement = {
  id: string;
  animalType: string;
  breedOrVariety: string;
  feedType: string;
  dailyFeedAmount: string;
  dailyWaterRequirement: string;
  unit: string;
  isDefault?: boolean;
};

export type FeedSchedule = {
  id: string;
  livestockId: string;
  animalTag?: string;
  feedType: string;
  feedAmount: string;
  waterRequirement: string;
  scheduledTime: string;
  status: string;
  assignedWorkerId?: string | null;
  taskId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FeedLog = {
  id: string;
  livestock_id?: string;
  livestockId?: string;
  animalTag?: string;
  feeding_session: string;
  scheduled_time?: string;
  completion_time: string;
  feed_required: number;
  feed_given: number;
  water_required: number;
  water_given: number;
  difference_feed: number;
  difference_water: number;
  workerName?: string;
  notes?: string;
  appetite?: string;
  health_observation?: string;
  status: string;
};

export async function getFeedRequirements(): Promise<FeedRequirement[]> {
  const response = await apiFetch('/api/livestock/feed-requirements');
  if (!response.ok) {
    throw new Error('Failed to load feed requirements');
  }
  return response.json();
}

export async function upsertFeedRequirement(id: string | null, data: Partial<FeedRequirement>): Promise<FeedRequirement> {
  const response = await apiFetch(id ? `/api/livestock/feed-requirements/${id}` : '/api/livestock/feed-requirements', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save feed requirement');
  }

  return response.json();
}

export async function deleteFeedRequirement(id: string): Promise<void> {
  const response = await apiFetch(`/api/livestock/feed-requirements/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete feed requirement');
  }
}

export async function getFeedSchedules(): Promise<FeedSchedule[]> {
  const response = await apiFetch('/api/livestock/feed-schedules');
  if (!response.ok) throw new Error('Failed to load feed schedules');
  return response.json();
}

export async function createFeedSchedule(payload: any): Promise<FeedSchedule> {
  const response = await apiFetch('/api/livestock/feed-schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to create feed schedule');
  return response.json();
}

export async function getFeedLogs(): Promise<FeedLog[]> {
  const response = await apiFetch('/api/livestock/feed-schedules/logs');
  if (!response.ok) throw new Error('Failed to load feed logs');
  return response.json();
}

export async function getFeedSummary(): Promise<any> {
  const response = await apiFetch('/api/livestock/feed-schedules/summary');
  if (!response.ok) throw new Error('Failed to load feed summary');
  return response.json();
}

export async function completeFeedSchedule(id: string, payload: any): Promise<any> {
  const response = await apiFetch(`/api/livestock/feed-schedules/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to complete feeding');
  return response.json();
}
