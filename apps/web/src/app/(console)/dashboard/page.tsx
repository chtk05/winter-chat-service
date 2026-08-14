"use client";

import { useEffect, useState } from "react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardSummary } from "@/lib/api/client";
import type { DashboardSummary } from "@/lib/api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [range, setRange] = useState<"today" | "7d">("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDashboardSummary(range)
      .then((next) => {
        if (!cancelled) setSummary(next);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <DashboardView
      summary={summary}
      range={range}
      onRangeChange={(next) => {
        setLoading(true);
        setError(null);
        setRange(next);
      }}
      loading={loading}
      error={error}
    />
  );
}
