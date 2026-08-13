import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Removes undefined values and non-serializable properties recursively to make objects Firestore-compatible.
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined || obj === null) return null;
  if (typeof obj === 'function') return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore).filter(v => v !== undefined && v !== null);
  } else if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && typeof v !== 'function') {
        const sanitizedVal = sanitizeForFirestore(v);
        if (sanitizedVal !== undefined && sanitizedVal !== null) {
          clean[k] = sanitizedVal;
        }
      }
    }
    return clean;
  }
  return obj;
}
