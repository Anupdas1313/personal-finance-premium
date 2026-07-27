import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Round a number to 2 decimal places to avoid IEEE-754 floating-point errors.
 * Use this for all currency arithmetic results.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Safely parse a value to a number and round to 2 decimal places.
 * Handles undefined, null, NaN, and string inputs.
 */
export function safeAmount(val: unknown): number {
  const n = typeof val === 'number' ? val : Number(val);
  return isNaN(n) ? 0 : roundCurrency(n);
}
