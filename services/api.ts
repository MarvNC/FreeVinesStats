import { StatsData } from '../types';

export const fetchStats = async (): Promise<StatsData> => {
  const response = await fetch('https://vine-api.maarv.dev/stats.json');
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
};
