import type { InfoClass, RatingLevel, QualityLevel } from '@shared/types';

export function formatInfoClass(value: InfoClass): string {
  return value === 'verified' ? 'Verified' : value === 'reported' ? 'Reported' : 'Unknown';
}

export function ratingLabel(r: RatingLevel): string {
  return r === 'strong' ? 'Strong' : r === 'developing' ? 'Developing' : 'Needs work';
}

export function qualityLabel(q: QualityLevel): string {
  return q === 'strong' ? 'Strong' : q === 'mixed' ? 'Mixed' : 'Weak';
}

export function difficultyLabel(d: string): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
