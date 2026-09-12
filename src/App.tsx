import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Users, 
  CreditCard, 
  FileText, 
  Settings, 
  Plus, 
  Building2, 
  CheckCircle2, 
  ShieldCheck, 
  Database as DbIcon,
  RefreshCw
} from 'lucide-react';
import { SecretsConfigForm } from './components/SecretsConfigForm';
import { StudentFeeDashboard } from './components/StudentFeeDashboard';
import { StudentManagement } from './components/StudentManagement';
import { FeeLedger } from './components/FeeLedger';
import { PaymentHistory } from './components/PaymentHistory';
import { AddStudentModal } from './components/AddStudentModal';
import { ReceiptModal } from './components/ReceiptModal';

type ActiveTab = 'calculator' | 'students' | 'fees' | 'payments' | 'config';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calculator');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [stats, setStats] = useState<{
    total_students: number;
    total_collected: number;
    total_pending: number;
  } | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      if (json.success && json.data) {
        setStats({
          total_students: json.data.total_students || 0,
          total_collected: json.data.total_collected || 0,
          total_pending: json.data.total_pending || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSelectStudentForFee = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('calculator');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Institute Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
                GIIT
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base font-bold tracking-tight text-white">
                    GIIT Fee Management System
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                    v2.0 Academic Engine
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Global Institute of Information & Technology • Odd/Even Cycle & Installment Engine
                </p>
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex items-center space-x-3">
              {stats && (
                <div className="hidden md:flex items-center space-x-4 px-3 py-1 bg-slate-800 rounded-xl border border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Students</span>
                    <span className="font-bold text-white">{stats.total_students}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-700" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Collected</span>
                    <span className="font-bold text-emerald-400">₹{stats.total_collected.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Student</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-none text-xs font-semibold">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-3.5 py-2 rounded-lg flex items-center space-x-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'calculator'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Fee Calculator & Status</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`px-3.5 py-2 rounded-lg flex items-center space-x-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Students Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('fees')}
              className={`px-3.5 py-2 rounded-lg flex items-center space-x-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'fees'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Fee Demands</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3.5 py-2 rounded-lg flex items-center space-x-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'payments'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Payment History & Receipts</span>
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-2 rounded-lg flex items-center space-x-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Backend & Environment Secrets</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'calculator' && (
          <StudentFeeDashboard
            initialStudentId={selectedStudentId}
            onOpenReceipt={(receipt) => setActiveReceipt(receipt)}
            onRefreshStats={fetchStats}
          />
        )}

        {activeTab === 'students' && (
          <StudentManagement
            onSelectStudent={handleSelectStudentForFee}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        )}

        {activeTab === 'fees' && (
          <FeeLedger
            onFeeCreated={fetchStats}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentHistory
            onOpenReceipt={(receipt) => setActiveReceipt(receipt)}
          />
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <SecretsConfigForm />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-slate-700">Global Institute of Information & Technology</span>
            <span>• Academic Fee Portal</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Odd/Even Cycle Engine</span>
            <span>•</span>
            <span>HMAC-SHA256 Razorpay Verified</span>
            <span>•</span>
            <span>SQLite Embedded Database</span>
          </div>
        </div>
      </footer>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={() => {
          fetchStats();
        }}
      />

      {/* Official Printable Receipt Modal */}
      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
}
