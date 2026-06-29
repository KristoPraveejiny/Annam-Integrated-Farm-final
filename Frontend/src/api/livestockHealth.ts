import { apiFetch } from '../utils/apiFetch';

export type LivestockHealthEvent = {
  id: string;
  livestockId: string;
  animalTag?: string;
  healthIssue: string;
  symptoms?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  vaccinationDetails?: string | null;
  eventDate: string;
  status: string;
};

export async function getLivestockHealthEvents(): Promise<LivestockHealthEvent[]> {
  const response = await apiFetch('/api/livestock/health-events');
  if (!response.ok) {
    throw new Error('Failed to load livestock health events');
  }
  return response.json();
}

export async function createLivestockHealthEvent(payload: Partial<LivestockHealthEvent> & { livestockId: string; healthIssue: string; status: string }): Promise<LivestockHealthEvent> {
  const response = await apiFetch('/api/livestock/health-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Failed to save livestock health event');
  }
  return response.json();
}
