import React from 'react';
import type { CultureStatus } from '../../types/domain';

interface SealStampProps {
  score: number;
  status: CultureStatus;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const STATUS_TEXT: Record<CultureStatus, string> = {
  KEEP: 'Chuẩn',
  CONSIDER: 'Lưu ý',
  WARNING: 'Cảnh báo',
};

const SIZE: Record<NonNullable<SealStampProps['size']>, string> = {
  sm: 'size-12 text-[9px]',
  md: 'size-16 text-[10px]',
  lg: 'size-24 text-xs',
};

/**
 * Vstyle signature: a cinnabar seal (triện son) that "stamps" the cultural verdict,
 * the way scholars sealed a verified document. Colour follows the verdict.
 */
export const SealStamp: React.FC<SealStampProps> = ({ score, status, size = 'md', animate = false }) => {
  const tone = status === 'KEEP'
    ? 'bg-son-600 text-amber-50 ring-son-400/40'
    : status === 'CONSIDER'
      ? 'bg-amber-600 text-stone-950 ring-amber-300/40'
      : 'bg-stone-700 text-son-300 ring-son-500/60';

  return (
    <div
      role="img"
      aria-label={`Dấu Chuẩn văn hóa: ${STATUS_TEXT[status]}, ${score} trên 100`}
      className={`relative inline-grid shrink-0 place-items-center rounded-[10px] ring-4 ring-inset ${tone} ${SIZE[size]} ${animate ? 'animate-stamp' : '-rotate-6'} shadow-lg shadow-black/40`}
    >
      <span aria-hidden="true" className="absolute inset-1 rounded-[7px] border border-current/40" />
      <span aria-hidden="true" className="flex flex-col items-center leading-none">
        <span className="font-serif font-bold tabular" style={{ fontSize: size === 'lg' ? '1.9rem' : size === 'md' ? '1.25rem' : '0.95rem' }}>{score}</span>
        <span className="mt-1 font-semibold uppercase tracking-[0.18em]">{STATUS_TEXT[status]}</span>
      </span>
    </div>
  );
};
