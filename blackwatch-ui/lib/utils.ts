import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name helper used by every shadcn-style component: joins conditional
 * classes (clsx) and resolves Tailwind conflicts so a caller's `className`
 * reliably overrides a component default (twMerge), e.g. `px-2` beats `px-3`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
