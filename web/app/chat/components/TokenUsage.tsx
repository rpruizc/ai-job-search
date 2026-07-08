"use client";

import { useState, useEffect, useCallback } from "react";

interface UsageData {
  usage: { total_tokens: number };
  limit: number;
  remaining: number;
  percentage: number;
}

export function TokenUsage({ refreshTrigger }: { refreshTrigger: number }) {
  const [data, setData] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently ignore - non-critical UI element
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage, refreshTrigger]);

  if (!data) return null;

  const pct = data.percentage;
  const barColor =
    pct >= 100
      ? "bg-red-500"
      : pct >= 75
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span>{pct}% of daily budget</span>
    </div>
  );
}
