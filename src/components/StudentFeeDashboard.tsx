import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  FileText,
  GraduationCap
} from 'lucide-react';
import { DetailedFeeCalculation, Student } from '../types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface StudentFeeDashboardProps {
  initialStudentId?: string;
  onOpenReceipt: (receipt: any) => void;
  onRefreshStats?: () => void;
}

export const StudentFeeDashboard: React.FC<StudentFeeDashboardProps> = ({
  initialStudentId,
  onOpenReceipt,
  onRefreshStats,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [calculation, setCalculation] = useState<DetailedFeeCalculation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<number>(0);

  // Fetch student list for selector
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch('/api/students');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setStudents(json.data);
          if (!selectedStudentId && json.data.length > 0) {
            setSelectedStudentId(json.data[0].student_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch students', err);
      }
    };
    fetchStudents();
  }, []);

  // Fetch detailed fee status calculation whenever selected student changes
  const fetchFeeStatus = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/fee-status`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load fee calculation');
      }
      setCalculation(json.data);
      setPayAmount(json.data.total_pending_amount > 0 ? json.data.total_pending_amount : json.data.installment_2_fee || 25000);
    } catch (err: any) {
      setError(err.message || 'Error loading fee calculation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      fetchFeeStatus(selectedStudentId);
    }
  }, [selectedStudentId]);

  // Handle Razorpay Payment flow
  const handleRazorpayPay = async () => {
    if (!calculation || payAmount <= 0) return;

    setPaying(true);
    setError(null);

    try {
      // Find fee to pay against (either pending fee or current semester fee)
      const targetFee = calculation.breakdown.find(b => b.pending_amount > 0) || calculation.breakdown[0];
      const feeId = targetFee ? targetFee.fee_id : undefined;

      // 1. Create order server-side
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: calculation.student_id,
          fee_id: feeId,
          amount: payAmount,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to initialize payment order');
      }

      const { order_id, amount, currency, key_id } = orderData.data;

      // If Razorpay modal script is loaded
      if (typeof window.Razorpay !== 'undefined') {
        const options = {
          key: key_id,
          amount: amount * 100,
          currency: currency,
          name: 'GIIT Fee Management',
          description: `Fee Payment - ${calculation.student_name} (${calculation.course} Sem ${calculation.current_semester})`,
          order_id: order_id,
          handler: async (response: any) => {
            try {
              // 2. Verify signature server-side
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  student_id: calculation.student_id,
                  fee_id: feeId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || 'Payment signature verification failed');
              }

              // Refresh calculation and open receipt
              await fetchFeeStatus(calculation.student_id);
              if (onRefreshStats) onRefreshStats();

              if (verifyData.data?.receipt) {
                onOpenReceipt(verifyData.data.receipt);
              }
            } catch (err: any) {
              setError(err.message || 'Payment verification failed');
            }
          },
          prefill: {
            name: calculation.student_name,
            contact: '9876543210',
          },
          theme: {
            color: '#f59e0b',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback simulation in test environments where external popup is restricted
        setError('Razorpay SDK loading. Please make sure popups are allowed, or check network.');
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Selector Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Student Fee Status & Breakdown</h2>
            <p className="text-xs text-slate-500">
              Odd/Even Semester cycles, fee installments, and advance allocation engine
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-medium text-slate-500 shrink-0">Select Student:</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            {students.map((stu) => (
              <option key={stu.student_id} value={stu.student_id}>
                {stu.student_name} ({stu.course} • Sem {stu.semester}) — {stu.enrollment_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-400 text-xs font-medium">
          Computing real-time fee breakdown and academic cycle status...
        </div>
      )}

      {calculation && !loading && (
        <>
          {/* Status Alert Banner */}
          {calculation.is_cleared ? (
            <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-extrabold text-emerald-900 tracking-tight">
                      Your Fee is Cleared
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                      {calculation.fee_status}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    All tuition and exam obligations for {calculation.course} (Semester {calculation.current_semester}) have been settled.
                    {calculation.advance_amount > 0 && (
                      <span className="font-semibold text-emerald-900 block mt-1">
                        Advance Paid for Next Semester: ₹{calculation.advance_amount.toLocaleString('en-IN')}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Next Cycle Pill */}
              <div className="bg-white/80 border border-emerald-200 rounded-xl p-3 text-xs text-right">
                <span className="text-slate-400 block text-[11px] font-medium">Next Payment Cycle</span>
                <span className="font-bold text-slate-800">{calculation.next_payment_cycle.next_cycle_name}</span>
                <span className="block text-emerald-700 font-semibold mt-0.5">
                  Advance Due: {calculation.next_payment_cycle.next_due_date}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-extrabold text-amber-900 tracking-tight">
                      Pending Fee Balance
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-900">
                      {calculation.fee_status}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Previous Unpaid: ₹{calculation.previous_pending_fee.toLocaleString('en-IN')} • Current Semester Demanded: ₹{calculation.current_semester_fee.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-amber-800 font-medium block">Total Outstanding Amount</span>
                <span className="text-2xl font-black text-amber-900">
                  ₹{calculation.total_pending_amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Academic & Financial Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Course & Semester Info */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-xs text-slate-400 font-medium">Program & Semester</span>
              <div className="text-base font-bold text-slate-800">
                {calculation.course}
              </div>
              <div className="flex items-center space-x-1.5 pt-1">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                  Sem {calculation.current_semester} of {calculation.max_semesters}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${calculation.current_cycle.cycle_type === 'ODD' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'}`}>
                  {calculation.current_cycle.cycle_type} Sem
                </span>
              </div>
            </div>

            {/* Academic Cycle */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-xs text-slate-400 font-medium">Exam & Fee Cycle</span>
              <div className="text-sm font-bold text-slate-800 truncate">
                {calculation.current_cycle.cycle_name}
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Advance window: <strong className="text-slate-700">{calculation.current_cycle.advance_due_date_str}</strong>
              </p>
            </div>

            {/* Total Paid */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Amount Paid</span>
              <div className="text-xl font-bold text-emerald-600">
                ₹{calculation.total_paid.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400">
                Prev Cleared: ₹{calculation.paid_towards_previous.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Total Pending */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Due Balance</span>
              <div className={`text-xl font-bold ${calculation.total_pending_amount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                ₹{calculation.total_pending_amount.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400">
                {calculation.is_cleared ? 'All accounts up to date' : 'Immediate settlement needed'}
              </div>
            </div>
          </div>

          {/* Installment Structure Breakdown (50% Odd, 50% Even) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Annual Fee & Equal Installment Structure</h3>
                <p className="text-xs text-slate-500">
                  Annual fee is strictly divided into two equal 50% installments with fixed advance dates.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
                Annual: ₹{calculation.annual_fee.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-indigo-900">Installment 1 — Odd Semester Fee</span>
                  <span className="text-xs font-mono font-bold text-indigo-700">₹{calculation.installment_1_fee.toLocaleString('en-IN')} (50%)</span>
                </div>
                <p className="text-[11px] text-indigo-700/80">
                  Covers Odd Semester Tuition • Advance payment due date: <strong>15 October</strong>
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-amber-900">Installment 2 — Even Semester Fee</span>
                  <span className="text-xs font-mono font-bold text-amber-700">₹{calculation.installment_2_fee.toLocaleString('en-IN')} (50%)</span>
                </div>
                <p className="text-[11px] text-amber-700/80">
                  Covers Even Semester Tuition • Advance payment due date: <strong>15 April</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Fee Line Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Fee Head Breakdown & Ledger (Waterfall Allocated)
              </span>
              <span className="text-xs text-slate-400">
                Payments automatically prioritize older arrears
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Semester & Cycle</th>
                    <th className="py-2.5 px-4">Fee Head</th>
                    <th className="py-2.5 px-4 text-right">Demanded</th>
                    <th className="py-2.5 px-4 text-right">Paid</th>
                    <th className="py-2.5 px-4 text-right">Pending</th>
                    <th className="py-2.5 px-4">Due Date</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculation.breakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No individual fee demand records found. Current cycle defaults to active installment.
                      </td>
                    </tr>
                  ) : (
                    calculation.breakdown.map((item) => (
                      <tr key={item.fee_id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-medium text-slate-800">
                          Semester {item.semester} ({item.cycle_type})
                          {item.is_previous_pending && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-semibold rounded">
                              Previous Arrear
                            </span>
                          )}
                          {item.is_current_semester && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded">
                              Current Sem
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{item.fee_type}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          ₹{item.paid_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          ₹{item.pending_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{item.due_date}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Pay with Razorpay Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <div className="flex items-center space-x-2 text-amber-400">
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Secure Razorpay Online Payment
                </span>
              </div>
              <h3 className="text-lg font-bold">
                {calculation.is_cleared
                  ? 'Pay Advance for Next Semester'
                  : 'Settle Outstanding Fees Instantly'}
              </h3>
              <p className="text-xs text-slate-300">
                Server-side HMAC-SHA256 signature verified. Sequential official receipt generated immediately upon clearance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-44">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <button
                onClick={handleRazorpayPay}
                disabled={paying || payAmount <= 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{paying ? 'Processing...' : `Pay ₹${payAmount.toLocaleString('en-IN')}`}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
