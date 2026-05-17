"use client";

// Read-only customer-points report. Boss reviews who has points, then
// manually creates the voucher (existing /admin custom voucher form) and
// WhatsApps the customer using the per-row "Copy WhatsApp" button.
//
// No writes happen from this page — Firestore never gets touched.
// Phase 2 (2026-05-31): delete this page + /api/admin/migrate-points.
// See tasks/points-sunset-plan.md.

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle } from '@/lib/auth';
import { ArrowLeft, Loader2, Download, Copy, CheckCircle, RefreshCw } from 'lucide-react';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

type Candidate = {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  pointsBefore: number;
  voucherRM: number;
  code: string;
  whatsapp: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    eligibleCustomers: number;
    skipped: number;
    totalPoints: number;
    totalVoucherRM: number;
  };
  candidates?: Candidate[];
  skipped?: { uid: string; displayName: string; email: string; points: number; reason: string }[];
};

export default function PointsReportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email);

  const loadReport = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/migrate-points', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse = await res.json();
      setResponse(data);
      if (!res.ok) setError(data.error || `HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on admin login.
  useEffect(() => {
    if (isAdmin && !response && !loading) {
      void loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const copyMessage = (c: Candidate) => {
    navigator.clipboard.writeText(c.whatsapp);
    setCopiedUid(c.uid);
    setTimeout(() => setCopiedUid(null), 1800);
  };

  const downloadJson = () => {
    if (!response) return;
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `points-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (!response?.candidates) return;
    const header = 'displayName,phone,email,points,suggestedRM,suggestedCode';
    const rows = response.candidates.map(c =>
      [c.displayName, c.phone, c.email, c.pointsBefore, c.voucherRM, c.code]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `points-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authChecked) return <Loading label="检查登录状态…" />;

  if (!user) {
    return (
      <Shell>
        <h1 className="text-2xl font-black mb-4">客户积分报告</h1>
        <p className="mb-4 text-gray-600">需要登录 admin 账户。</p>
        <button
          onClick={() => signInWithGoogle()}
          className="px-5 py-3 bg-[#FF6B35] text-white rounded-xl font-bold"
        >
          用 Google 登录
        </button>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <h1 className="text-2xl font-black mb-4">无权限</h1>
        <p className="text-gray-600">{user.email} 不是 admin 账户。</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-black">客户积分报告</h1>
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          刷新
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-900">
        <p className="font-bold mb-1">📋 只读报告</p>
        <p className="leading-relaxed">这个工具只显示数据，<strong>不会自动创建 voucher、不会修改客户积分</strong>。每一行右边的「复制 WhatsApp」按钮一键复制讯息，你贴到客户的 WhatsApp 就行。要实际给客户 voucher，到 <Link href="/admin" className="underline font-bold">/admin</Link> 的 Vouchers 页用 custom voucher 表单创建（code 用本页提示的 <code className="bg-blue-100 px-1 rounded">LP[NAME][RM]</code>）。</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-800 text-sm">
          ❌ {error}
        </div>
      )}

      {loading && !response && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
          <Loader2 size={24} className="animate-spin mx-auto mb-2" />
          加载客户积分数据…
        </div>
      )}

      {response?.summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="有积分的客户" value={response.summary.eligibleCustomers} />
            <Stat label="跳过（admin/无名字）" value={response.summary.skipped} />
            <Stat label="积分总和" value={response.summary.totalPoints} />
            <Stat label="Voucher 总额" value={`RM ${response.summary.totalVoucherRM}`} highlight="green" />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={downloadCsv}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={downloadJson}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Download size={12} /> JSON
            </button>
          </div>
        </>
      )}

      {response?.candidates && response.candidates.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="font-bold text-sm">客户清单（{response.candidates.length}）— 按积分高到低</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">姓名</th>
                  <th className="px-3 py-2 text-left">电话</th>
                  <th className="px-3 py-2 text-right">积分</th>
                  <th className="px-3 py-2 text-right">RM</th>
                  <th className="px-3 py-2 text-left">建议 Code</th>
                  <th className="px-3 py-2 text-center">动作</th>
                </tr>
              </thead>
              <tbody>
                {response.candidates.map((c) => {
                  const isCopied = copiedUid === c.uid;
                  return (
                    <tr key={c.uid} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{c.displayName}</td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">{c.phone || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.pointsBefore}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">RM {c.voucherRM}</td>
                      <td className="px-3 py-2 font-mono">{c.code}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => copyMessage(c)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 mx-auto transition-all ${
                            isCopied
                              ? 'bg-green-500 text-white'
                              : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'
                          }`}
                        >
                          {isCopied ? <><CheckCircle size={11} /> 已复制</> : <><Copy size={11} /> 复制 WhatsApp</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {response?.skipped && response.skipped.length > 0 && (
        <details className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
          <summary className="font-bold text-sm cursor-pointer">跳过的账户（{response.skipped.length}）</summary>
          <ul className="text-xs space-y-1 text-gray-600 mt-3">
            {response.skipped.map(s => (
              <li key={s.uid}>
                <span className="font-mono">{s.uid.slice(0, 8)}</span> · {s.displayName || '(无名字)'} · {s.email || '(无 email)'} · {s.points} 分 · <span className="text-gray-400">{s.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {response?.candidates && response.candidates.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
          🎉 没有客户有未使用的积分了。
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 size={20} className="animate-spin" />
      {label}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: 'green' | 'red' }) {
  const color =
    highlight === 'green' ? 'text-emerald-700'
    : highlight === 'red' ? 'text-red-600'
    : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">{label}</p>
      <p className={`text-xl font-black tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
