"use client";

import { useState } from "react";
import { FormControl, MenuItem, Select } from "@mui/material";

export type TzKey = "UTC" | "PST" | "IST";

// IANA zone per label — Intl uses these for actual TZ math (handles DST for PST).
export const TZ_ZONE: Record<TzKey, string> = {
  UTC: "UTC",
  PST: "America/Los_Angeles",
  IST: "Asia/Kolkata",
};

const TZ_OPTIONS: TzKey[] = ["UTC", "PST", "IST"];

// Compact BW-styled dropdown. Persists selection in localStorage so the
// operator's TZ preference sticks across page loads.
export function TimezoneSelect({
  value,
  onChange,
  storageKey,
}: {
  value: TzKey;
  onChange: (v: TzKey) => void;
  storageKey?: string;
}) {
  function select(v: TzKey) {
    onChange(v);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {}
    }
  }

  return (
    <FormControl size="small" sx={{ minWidth: 76 }}>
      <Select value={value} onChange={(event) => select(event.target.value as TzKey)} inputProps={{ "aria-label": "Timezone" }} sx={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", "& .MuiSelect-select": { py: 0.5, px: 1 } }}>
        {TZ_OPTIONS.map((tz) => <MenuItem key={tz} value={tz} sx={{ fontSize: 10 }}>{tz}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

// Format helpers ------------------------------------------------------------

/** "Nov 12, 14:00" style — for axis ticks. Long ranges add the date; ≤24h
 * hides it to keep ticks readable. */
export function formatAxisTick(ts: number, tz: TzKey, showDate: boolean): string {
  const d = new Date(ts * 1000);
  const zone = TZ_ZONE[tz];
  const time = d.toLocaleTimeString("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (!showDate) return time;
  const date = d.toLocaleDateString("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
  });
  return `${date} ${time}`;
}

/** Full "Mon Nov 12 · 14:00 PST" for tooltip header. */
export function formatTooltipStamp(ts: number, tz: TzKey): string {
  const d = new Date(ts * 1000);
  const zone = TZ_ZONE[tz];
  const date = d.toLocaleDateString("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time} ${tz}`;
}
