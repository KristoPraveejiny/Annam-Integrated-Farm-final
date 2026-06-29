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
