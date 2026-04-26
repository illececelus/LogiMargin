import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const fmt = {
  currency: (v: number, d = 2) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
  percent: (v: number, d = 1) => `${(v * 100).toFixed(d)}%`,
  rpm: (v: number) => `$${v.toFixed(2)}/mi`,
  miles: (v: number) => `${v.toFixed(0)} mi`,
  number: (v: number) => new Intl.NumberFormat('en-US').format(v),
};
