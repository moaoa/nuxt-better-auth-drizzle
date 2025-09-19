import type { Updater } from "@tanstack/vue-table";
//@ts-expect-error ignore clsx type
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function tw(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function valueUpdater<T extends Updater<any>>(
  updaterOrValue: T,
  ref: Ref
) {
  ref.value =
    typeof updaterOrValue === "function"
      ? updaterOrValue(ref.value)
      : updaterOrValue;
}

export const serviceKeyRouteMap = {
  notion: "/app/services/connect/notion",
  quickbooks: "/app/services/connect/quickbooks",
  google_sheet: "/app/services/connect/google-sheets",
};
