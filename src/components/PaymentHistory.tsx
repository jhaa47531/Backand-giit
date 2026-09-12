import React, { useState, useEffect } from 'react';
import { CreditCard, Search, FileText, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Payment } from '../types';

interface PaymentHistoryProps {
  onOpenReceipt: (receipt: any) => void;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ onOpenReceipt }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fetchingReceiptId, setFetchingReceiptId] = useState<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPayments(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch payments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleViewReceipt = async (paymentId: string) => {
    setFetchingReceiptId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}/receipt`);
      const json = await res.json();
      if (json.success && json.data) {
        onOpenReceipt(json.data);
      } else {
        alert('Could not retrieve receipt: ' + (json.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error fetching receipt: ' + err.message);
    } finally {
      setFetchingReceiptId(null);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.payment_id.toLowerCase().includes(q) ||
      p.student_id.toLowerCase().includes(q) ||
      (p.transaction_reference && p.transaction_reference.toLowerCase().includes(q)) ||
      (p.razorpay_order_id && p.razorpay_order_id.toLowerCase().includes(q)) ||
      (p.razorpay_payment_id && p.razorpay_payment_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      {/* Search Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search payments by ID or Razorpay ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>All transactions HMAC-SHA256 signature verified</span>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4">Fee ID</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4">Mode & Gateway Ref</th>
                <th className="py-3 px-4">Payment Date</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading payments history...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No verified payment records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.payment_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.payment_id}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{p.student_id}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{p.fee_id}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 uppercase">{p.payment_mode}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {p.razorpay_payment_id || p.transaction_reference}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.payment_status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.payment_status === 'REFUNDED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewReceipt(p.payment_id)}
                        disabled={fetchingReceiptId === p.payment_id}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg text-xs transition inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{fetchingReceiptId === p.payment_id ? 'Loading...' : 'Receipt'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
