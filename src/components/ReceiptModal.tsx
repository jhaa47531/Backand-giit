import React from 'react';
import { X, Printer, CheckCircle2, Download, ShieldCheck, Building2 } from 'lucide-react';

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-sm">Official GIIT Fee Receipt</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 space-y-6 text-slate-800" id="printable-receipt">
          {/* Institution Header */}
          <div className="text-center pb-4 border-b-2 border-slate-100">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-amber-400 font-bold text-xl mb-2">
              GIIT
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              GLOBAL INSTITUTE OF INFORMATION & TECHNOLOGY
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Affiliated & Approved Institute • Academic Fee Management Portal
            </p>
            <div className="inline-block mt-2 px-3 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              Official Electronic Receipt • Payment Verified
            </div>
          </div>

          {/* Receipt Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Receipt Number</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {receipt.receipt_number || 'RCP-2026-00000'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Receipt Date</span>
              <span className="font-semibold text-slate-800">
                {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Payment Mode</span>
              <span className="font-semibold text-slate-800 uppercase">
                {receipt.payment_details?.payment_mode || 'Razorpay Gateway'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Enrollment No.</span>
              <span className="font-mono font-bold text-slate-800">
                {receipt.student_details?.enrollment_number || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Student ID</span>
              <span className="font-mono text-slate-700">
                {receipt.student_details?.student_id || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Academic Session</span>
              <span className="font-semibold text-slate-800">
                {receipt.fee_details?.academic_session || '2026-2027'}
              </span>
            </div>
          </div>

          {/* Student & Course Details */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Student Name</span>
              <span className="font-bold text-slate-900 text-sm">
                {receipt.student_details?.student_name}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Course & Semester</span>
              <span className="font-semibold text-slate-800">
                {receipt.student_details?.course || receipt.fee_details?.course} — Semester {receipt.fee_details?.semester || receipt.student_details?.semester}
              </span>
            </div>
            {receipt.student_details?.father_name && (
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Father's Name</span>
                <span className="text-slate-700">{receipt.student_details.father_name}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Fee Head / Description</span>
              <span className="font-semibold text-slate-800">
                {receipt.fee_details?.fee_type || 'Academic Fee'}
              </span>
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Item Description</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    {receipt.fee_details?.fee_type || 'Academic Semester Fee'} (Semester {receipt.fee_details?.semester})
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-800">
                    ₹{Number(receipt.payment_details?.amount_paid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold text-sm text-slate-900">
                  <td className="py-3 px-4">Total Amount Received</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600">
                    ₹{Number(receipt.payment_details?.amount_paid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Gateway Tracking IDs */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-[11px] space-y-1">
            <div className="flex items-center space-x-1.5 text-amber-900 font-semibold">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Gateway Settlement Verification (HMAC-SHA256 Authenticated)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-600 font-mono">
              <div>Razorpay Order: {receipt.payment_details?.razorpay_order_id || 'N/A'}</div>
              <div>Razorpay Payment: {receipt.payment_details?.razorpay_payment_id || 'N/A'}</div>
            </div>
          </div>

          {/* Footer Sign-off */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Computer Generated Receipt</p>
              <p>Valid without physical signature</p>
            </div>
            <div className="text-right">
              <div className="w-24 h-8 border border-slate-300 rounded flex items-center justify-center font-serif text-[10px] text-slate-400">
                GIIT FINANCE
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Seal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
