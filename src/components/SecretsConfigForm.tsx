import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Database as DbIcon, 
  ShieldCheck, 
  CreditCard, 
  Save, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Server, 
  Terminal, 
  FileCode2,
  ExternalLink,
  SlidersHorizontal,
  Check
} from 'lucide-react';

interface EnvConfig {
  DATABASE_FILE: string;
  JWT_SECRET: string;
  JWT_SECRET_MASKED?: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_KEY_SECRET_MASKED?: string;
  PORT?: number;
  NODE_ENV?: string;
  status?: {
    database_connected: boolean;
    database_exists: boolean;
    database_size_bytes: number;
    env_file_exists: boolean;
    table_counts: {
      students: number;
      fees: number;
      payments: number;
    };
  };
}

export const SecretsConfigForm: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingRzp, setTestingRzp] = useState<boolean>(false);
  const [testingHealth, setTestingHealth] = useState<boolean>(false);

  // Form states
  const [databaseFile, setDatabaseFile] = useState<string>('./data/giit_fee_management.sqlite');
  const [jwtSecret, setJwtSecret] = useState<string>('');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState<string>('');
  const [port, setPort] = useState<number>(3000);
  const [nodeEnv, setNodeEnv] = useState<string>('development');

  // UI state
  const [showJwt, setShowJwt] = useState<boolean>(false);
  const [showRzpSecret, setShowRzpSecret] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rzpTestResult, setRzpTestResult] = useState<any | null>(null);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [metaStatus, setMetaStatus] = useState<any | null>(null);

  // Fetch initial config
  const fetchConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/system/config');
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setDatabaseFile(d.DATABASE_FILE || './data/giit_fee_management.sqlite');
        setJwtSecret(d.JWT_SECRET || '');
        setRazorpayKeyId(d.RAZORPAY_KEY_ID || '');
        setRazorpayKeySecret(d.RAZORPAY_KEY_SECRET || '');
        setPort(d.PORT || 3000);
        setNodeEnv(d.NODE_ENV || 'development');
        setMetaStatus(d.status || null);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to connect to backend configuration API: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setTestingHealth(true);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      if (json.success) {
        setHealthStatus(json.data);
      }
    } catch (err: any) {
      setHealthStatus({ error: err.message });
    } finally {
      setTestingHealth(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DATABASE_FILE: databaseFile,
          JWT_SECRET: jwtSecret,
          RAZORPAY_KEY_ID: razorpayKeyId,
          RAZORPAY_KEY_SECRET: razorpayKeySecret,
          PORT: port,
          NODE_ENV: nodeEnv,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback({
          type: 'success',
          message: 'Configuration successfully written to .env and applied to the running backend!',
        });
        fetchConfig();
      } else {
        setFeedback({
          type: 'error',
          message: json.message || 'Failed to save configuration',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Server communication error: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSecret = async () => {
    try {
      const res = await fetch('/api/system/generate-secret', { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data?.secret) {
        setJwtSecret(json.data.secret);
        setShowJwt(true);
        setFeedback({
          type: 'success',
          message: 'Generated new cryptographically random 64-character JWT secret. Click Save to apply.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Error generating secret: ' + err.message });
    }
  };

  const handleTestRazorpay = async () => {
    setTestingRzp(true);
    setRzpTestResult(null);
    try {
      const res = await fetch('/api/system/test-razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RAZORPAY_KEY_ID: razorpayKeyId,
          RAZORPAY_KEY_SECRET: razorpayKeySecret,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRzpTestResult({ success: true, data: json.data });
      } else {
        setRzpTestResult({ success: false, message: json.message });
      }
    } catch (err: any) {
      setRzpTestResult({ success: false, message: err.message });
    } finally {
      setTestingRzp(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div id="secrets-config-wrapper" className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Top Header */}
      <header id="main-header" className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white tracking-tight">GIIT Fee Management Backend</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                  Active on Port {port}
                </span>
              </div>
              <p className="text-xs text-slate-400">Environment Variables & Secrets Configuration Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="refresh-btn"
              onClick={() => { fetchConfig(); checkHealth(); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Reload Config
            </button>

            <a
              id="health-endpoint-link"
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              API Health
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="main-content" className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Banner Notification */}
        {feedback && (
          <div
            id="status-feedback-banner"
            className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-600/30 text-emerald-200'
                : 'bg-rose-950/40 border-rose-600/30 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm leading-relaxed">
              <p className="font-medium">{feedback.type === 'success' ? 'Configuration Updated' : 'Action Failed'}</p>
              <p className="text-slate-300 text-xs mt-0.5">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Introduction / Quick Status */}
        <div id="quick-metrics-bar" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Database Engine</p>
              <p className="text-sm font-semibold text-slate-200 mt-1 flex items-center gap-1.5">
                <DbIcon className="w-4 h-4 text-emerald-400" />
                SQLite (ACID Compliant)
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {metaStatus?.database_exists ? 'Persistent File' : 'Ready'}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gateway Encryption</p>
              <p className="text-sm font-semibold text-slate-200 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                HMAC-SHA256 Timing-Safe
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Active
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Database Records</p>
              <p className="text-sm font-semibold text-slate-200 mt-1 flex items-center gap-2">
                <span>{metaStatus?.table_counts?.students || 0} Students</span>
                <span className="text-slate-600">•</span>
                <span>{metaStatus?.table_counts?.payments || 0} Payments</span>
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {metaStatus?.database_size_bytes ? `${Math.round(metaStatus.database_size_bytes / 1024)} KB` : 'Initial'}
            </span>
          </div>
        </div>

        {/* Configuration Form */}
        <form id="environment-config-form" onSubmit={handleSave} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-base font-semibold text-white">Environment Variables & Secrets</h2>
                  <p className="text-xs text-slate-400">Modify runtime parameters and credentials directly. Changes are automatically written to <code className="text-indigo-300">.env</code> and updated in the server.</p>
                </div>
              </div>
              <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded">
                .env sync
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* DATABASE_FILE */}
              <div id="field-database-file" className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-database-file" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <DbIcon className="w-4 h-4 text-emerald-400" />
                    <span>DATABASE_FILE</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">SQLite Path</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDatabaseFile('./data/giit_fee_management.sqlite')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Reset to default path
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="input-database-file"
                    type="text"
                    value={databaseFile}
                    onChange={(e) => setDatabaseFile(e.target.value)}
                    required
                    placeholder="./data/giit_fee_management.sqlite"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 font-mono transition"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Target file path where SQLite tables, ACID write-ahead logs, and sequence counters persist. Parent folders are auto-created.
                </p>
              </div>

              {/* JWT_SECRET */}
              <div id="field-jwt-secret" className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-jwt-secret" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>JWT_SECRET</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">Secret Key</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSecret}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Strong Random Key
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="input-jwt-secret"
                    type={showJwt ? 'text' : 'password'}
                    value={jwtSecret}
                    onChange={(e) => setJwtSecret(e.target.value)}
                    required
                    placeholder="Enter production JWT signing secret..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg pl-3.5 pr-20 py-2.5 text-sm text-slate-100 font-mono transition"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowJwt(!showJwt)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                      title={showJwt ? 'Hide secret' : 'Show secret'}
                    >
                      {showJwt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(jwtSecret, 'jwt')}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                      title="Copy to clipboard"
                    >
                      {copiedKey === 'jwt' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Used by the backend to sign and verify authentication tokens for Admin and Student accounts. Enforces strict boundary authorization.
                </p>
              </div>

              {/* RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800">
                {/* RAZORPAY_KEY_ID */}
                <div id="field-razorpay-key-id" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="input-razorpay-key-id" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                      <span>RAZORPAY_KEY_ID</span>
                    </label>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                      razorpayKeyId.startsWith('rzp_live') 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {razorpayKeyId.startsWith('rzp_live') ? 'Production Mode' : 'Test Mode'}
                    </span>
                  </div>
                  <input
                    id="input-razorpay-key-id"
                    type="text"
                    value={razorpayKeyId}
                    onChange={(e) => setRazorpayKeyId(e.target.value)}
                    required
                    placeholder="rzp_test_..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 font-mono transition"
                  />
                  <p className="text-xs text-slate-400">
                    Your Razorpay public Key ID used for initial checkout order creation.
                  </p>
                </div>

                {/* RAZORPAY_KEY_SECRET */}
                <div id="field-razorpay-key-secret" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="input-razorpay-key-secret" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-rose-400" />
                      <span>RAZORPAY_KEY_SECRET</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">Server Only</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleTestRazorpay}
                      disabled={testingRzp || !razorpayKeySecret}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer disabled:opacity-50"
                    >
                      {testingRzp ? 'Testing...' : 'Test HMAC Signature'}
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="input-razorpay-key-secret"
                      type={showRzpSecret ? 'text' : 'password'}
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      required
                      placeholder="Enter Razorpay Key Secret..."
                      className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg pl-3.5 pr-20 py-2.5 text-sm text-slate-100 font-mono transition"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowRzpSecret(!showRzpSecret)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                        title={showRzpSecret ? 'Hide secret' : 'Show secret'}
                      >
                        {showRzpSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(razorpayKeySecret, 'rzp_sec')}
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                        title="Copy to clipboard"
                      >
                        {copiedKey === 'rzp_sec' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Strictly stored server-side. Never sent to the client. Used to calculate HMAC-SHA256 signature to verify legitimate payments.
                  </p>
                </div>
              </div>

              {/* Signature Test Output Box if triggered */}
              {rzpTestResult && (
                <div id="signature-test-box" className="p-3.5 bg-slate-950 rounded-xl border border-indigo-500/30 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-indigo-300 font-sans font-medium">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Razorpay HMAC-SHA256 Verification Test Passed
                    </span>
                    <button
                      type="button"
                      onClick={() => setRzpTestResult(null)}
                      className="text-slate-400 hover:text-slate-200 font-sans"
                    >
                      Close
                    </button>
                  </div>
                  <p className="text-slate-400 mt-1">
                    Sample Order: <span className="text-slate-200">{rzpTestResult.data?.test_order_id}</span>
                  </p>
                  <p className="text-slate-400">
                    Sample Payment: <span className="text-slate-200">{rzpTestResult.data?.test_payment_id}</span>
                  </p>
                  <p className="text-slate-400">
                    Computed Signature: <span className="text-emerald-400 break-all">{rzpTestResult.data?.hmac_signature}</span>
                  </p>
                </div>
              )}

              {/* Runtime Options (PORT & NODE_ENV) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <label htmlFor="input-port" className="text-xs font-medium text-slate-300">Server PORT</label>
                  <input
                    id="input-port"
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10))}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Port 3000 is required for external container ingress.</p>
                </div>
                <div>
                  <label htmlFor="input-node-env" className="text-xs font-medium text-slate-300">NODE_ENV</label>
                  <select
                    id="input-node-env"
                    value={nodeEnv}
                    onChange={(e) => setNodeEnv(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
                  >
                    <option value="development">development</option>
                    <option value="production">production</option>
                    <option value="test">test</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">Controls runtime logging and Vite dev middleware.</p>
                </div>
              </div>
            </div>

            {/* Form Submit & Reset Bar */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-slate-500" />
                <span>Writes directly to <code className="text-slate-200">.env</code> and reloads runtime state immediately.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={fetchConfig}
                  disabled={loading || saving}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  Discard Changes
                </button>
                <button
                  id="save-config-btn"
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  {saving ? 'Saving & Applying...' : 'Save Configuration Form'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Live Backend Verification Info */}
        <section id="system-diagnostic-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Backend Verification & Health Diagnostics
          </h3>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="text-emerald-400">GET /api/health</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="text-slate-200">{healthStatus?.status || 'Connecting...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Institution:</span>
              <span className="text-slate-200">{healthStatus?.institution || 'Global Institute of Information & Technology'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Runtime Environment:</span>
              <span className="text-slate-200">{healthStatus?.environment || 'development'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Test Commands:</span>
              <span className="text-indigo-400">npm test &amp; npm run test:api</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
