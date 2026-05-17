"use client";

// One-shot admin tool: convert all customer points balances into permanent
// RM vouchers, then download per-customer WhatsApp messages.
//
// Run dry-run first → review the table → click Commit when numbers look right.
// Phase 2 (2026-05-31): delete this page + /api/admin/migrate-points.
// See tasks/points-sunset-plan.md.

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle } from '@/lib/auth';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, Download } from 'lucide-react';

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

type Result = Candidate & { status: 'created' | 'failed'; error?: string };

type ApiResponse = {
  ok: boolean;
  mode: 'dry-run' | 'commit';
  error?: string;
  summary?: {
    eligibleCustomers: number;
    skipped: number;
    totalPoints: number;
    totalVoucherRM: number;
    batchCollisions: number;
    existingCodeConflicts: number;
    created?: number;
    failed?: number;
  };
  candidates?: Candidate[];
  skipped?: { uid: string; displayName: string; email: string; points: number; reason: string }[];
  collisions?: { code: string; uids: string[] }[];
  existingCodeConflicts?: { code: string; uid: string }[];
  results?: Result[];
};

export default function MigratePointsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [running, setRunning] = useState<false | 'dry-run' | 'commit'>(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email);

  const run = async (mode: 'dry-run' | 'commit') => {
    if (!user) return;
    setRunning(mode);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/migrate-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode }),
      });
      const data: ApiResponse = await res.json();
      setResponse(data);
      if (!res.ok && !data.summary) setError(data.error || `HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render gates ──────────────────────────────────────────
  if (!authChecked) {
    return <Loading label="检查登录状态…" />;
  }

  if (!user) {
    return (
      <Shell>
        <h1 className="text-2xl font-black mb-4">积分迁移工具</h1>
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

  const summary = response?.summary;
  const hasCollisions =
    (response?.collisions?.length ?? 0) > 0
    || (response?.existingCodeConflicts?.length ?? 0) > 0;
  const committed = response?.mode === 'commit' && (summary?.created ?? 0) > 0;

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-black">积分 → Voucher 迁移</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-900">
        <p className="font-bold mb-1">⚠️ 一次性操作</p>
        <p>先跑 <strong>Dry-run</strong> 看数字。确认无误后输入 <code className="bg-amber-100 px-1.5 py-0.5 rounded">CONFIRM</code> 解锁 Commit。Commit 会：</p>
        <ul className="list-disc ml-5 mt-2 space-y-0.5 text-xs">
          <li>为每个 points {`>`} 0 的客户创建一个永久 RM voucher（code = <code>LP[NAME][RM]</code>）</li>
          <li>把 <code>users.points</code> 归零 + 加 <code>pointsMigratedAt</code> 标记</li>
          <li>跳过 admin 账户、姓名为空的账户</li>
        </ul>
      </div>

      {/* ── Action buttons ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => run('dry-run')}
          disabled={running !== false}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
        >
          {running === 'dry-run' ? <Loader2 size={16} className="animate-spin" /> : null}
          {running === 'dry-run' ? '运行中…' : '1️⃣ Dry-run（不写数据）'}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            placeholder="输入 CONFIRM 解锁"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          />
          <button
            onClick={() => run('commit')}
            disabled={running !== false || confirmText !== 'CONFIRM' || !response || hasCollisions || committed}
            className="px-5 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-30 flex items-center gap-2"
          >
            {running === 'commit' ? <Loader2 size={16} className="animate-spin" /> : null}
            {running === 'commit' ? '写入中…' : '2️⃣ Commit（实际写入）'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-800 text-sm">
          ❌ {error}
        </div>
      )}

      {/* ── Summary ───────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="符合条件" value={summary.eligibleCustomers} />
          <Stat label="跳过" value={summary.skipped} />
          <Stat label="总积分" value={summary.totalPoints} />
          <Stat label="Voucher 总额" value={`RM ${summary.totalVoucherRM}`} />
          {response?.mode === 'commit' && (
            <>
              <Stat label="✅ 已创建" value={summary.created ?? 0} highlight="green" />
              <Stat label="❌ 失败" value={summary.failed ?? 0} highlight={summary.failed ? 'red' : undefined} />
            </>
          )}
        </div>
      )}

      {/* ── Collisions warning ────────────────────────────── */}
      {hasCollisions && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900">Code 冲突 — 必须先解决才能 Commit</p>
              <p className="text-xs text-red-700 mt-1">两个客户生成了相同的 code（同名 + 同金额），或 code 已存在于 vouchers 集合。</p>
            </div>
          </div>
          {(response?.collisions?.length ?? 0) > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-bold text-red-900 mb-1">批次内冲突：</p>
              <pre className="bg-white/60 p-2 rounded overflow-x-auto">
                {JSON.stringify(response?.collisions, null, 2)}
              </pre>
            </div>
          )}
          {(response?.existingCodeConflicts?.length ?? 0) > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-bold text-red-900 mb-1">已存在的 code：</p>
              <pre className="bg-white/60 p-2 rounded overflow-x-auto">
                {JSON.stringify(response?.existingCodeConflicts, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Commit success: download buttons ──────────────── */}
      {committed && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={24} className="text-green-600" />
            <div>
              <p className="font-bold text-green-900">迁移完成 — 下载 WhatsApp 讯息</p>
              <p className="text-xs text-green-700 mt-0.5">JSON 文件包含每个客户的 phone + 完整讯息，可粘贴到 mail merge 工具</p>
            </div>
          </div>
          <button
            onClick={() => downloadJson(
              `messages-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`,
              {
                generatedAt: new Date().toISOString(),
                summary: response?.summary,
                messages: response?.results?.filter(r => r.status === 'created').map(r => ({
                  uid: r.uid,
                  displayName: r.displayName,
                  phone: r.phone,
                  code: r.code,
                  voucherRM: r.voucherRM,
                  pointsBefore: r.pointsBefore,
                  whatsapp: r.whatsapp,
                })),
                errors: response?.results?.filter(r => r.status === 'failed'),
              },
            )}
            className="px-4 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm flex items-center gap-2"
          >
            <Download size={16} /> messages.json
          </button>
        </div>
      )}

      {/* ── Candidates table ──────────────────────────────── */}
      {response?.candidates && response.candidates.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <p className="font-bold text-sm">
              {response.mode === 'commit' ? '执行结果' : '预览'}（{response.candidates.length} 个客户）
            </p>
            <button
              onClick={() => downloadJson(
                `preview-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`,
                response,
              )}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold flex items-center gap-1"
            >
              <Download size={12} /> 全部 JSON
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">姓名</th>
                  <th className="px-3 py-2 text-right">积分</th>
                  <th className="px-3 py-2 text-right">RM</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">电话</th>
                  <th className="px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {(response.results && response.results.length > 0 ? response.results : response.candidates).map((row) => {
                  const r = row as Result;
                  return (
                    <tr key={r.uid} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{r.displayName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.pointsBefore}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">RM {r.voucherRM}</td>
                      <td className="px-3 py-2 font-mono">{r.code}</td>
                      <td className="px-3 py-2 text-gray-500">{r.phone || '—'}</td>
                      <td className="px-3 py-2">
                        {r.status === 'created' && <span className="text-green-600 font-bold">✅ created</span>}
                        {r.status === 'failed' && <span className="text-red-600 font-bold" title={r.error}>❌ {r.error}</span>}
                        {!r.status && <span className="text-gray-400">pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Skipped ───────────────────────────────────────── */}
      {response?.skipped && response.skipped.length > 0 && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
          <p className="font-bold text-sm mb-2">跳过的账户（{response.skipped.length}）</p>
          <ul className="text-xs space-y-1 text-gray-600">
            {response.skipped.map(s => (
              <li key={s.uid}>
                <span className="font-mono">{s.uid.slice(0, 8)}</span> · {s.displayName || '(无名字)'} · {s.email || '(无 email)'} · {s.points} 分 · <span className="text-gray-400">{s.reason}</span>
              </li>
            ))}
          </ul>
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
    highlight === 'green' ? 'text-green-600'
    : highlight === 'red' ? 'text-red-600'
    : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">{label}</p>
      <p className={`text-xl font-black tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
