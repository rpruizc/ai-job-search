"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UserUsage {
  user_id: number;
  clerk_id: string;
  display_name: string | null;
  today_input: number;
  today_output: number;
  today_total: number;
  all_time_input: number;
  all_time_output: number;
  all_time_total: number;
}

interface AdminData {
  users: UserUsage[];
  limit: number;
  totalToday: number;
  totalAllTime: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

export function AdminClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load admin data");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin - Usage Dashboard</h1>
          <Link
            href="/chat"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Back to Chat
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Daily Limit (per user)</p>
            <p className="text-2xl font-semibold">{formatTokens(data.limit)}</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Today (all users)</p>
            <p className="text-2xl font-semibold">{formatTokens(data.totalToday)}</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total All Time</p>
            <p className="text-2xl font-semibold">{formatTokens(data.totalAllTime)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Today (in)</th>
                <th className="px-4 py-3 text-right">Today (out)</th>
                <th className="px-4 py-3 text-right">Today Total</th>
                <th className="px-4 py-3 text-right">% of Limit</th>
                <th className="px-4 py-3 text-right">All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.users.map((user) => {
                const pct = Math.round((user.today_total / data.limit) * 100);
                return (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{user.display_name || user.clerk_id}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {formatTokens(user.today_input)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {formatTokens(user.today_output)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatTokens(user.today_total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          pct >= 100
                            ? "bg-red-100 text-red-700"
                            : pct >= 75
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {formatTokens(user.all_time_total)}
                    </td>
                  </tr>
                );
              })}
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No users yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
