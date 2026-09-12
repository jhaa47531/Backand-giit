import React, { useState, useEffect } from 'react';
import { Plus, Filter, Calendar, AlertCircle, CheckCircle2, Layers, DollarSign, X } from 'lucide-react';
import { Fee, Student } from '../types';

interface FeeLedgerProps {
  onFeeCreated?: () => void;
}

export const FeeLedger: React.FC<FeeLedgerProps> = ({ onFeeCreated }) => {
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterCourse, setFilterCourse] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [academicSession, setAcademicSession] = useState<string>('2026-2027');
  const [semester, setSemester] = useState<number>(1);
  const [feeType, setFeeType] = useState<string>('Tuition Fee');
  const [amount, setAmount] = useState<number>(35000);
  const [dueDate, setDueDate] = useState<string>('2026-10-15');
  const [creating, setCreating] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const [feeRes, stuRes] = await Promise.all([
        fetch('/api/fees'),
        fetch('/api/students'),
      ]);
      const feeJson = await feeRes.json();
      const stuJson = await stuRes.json();
      if (feeJson.success) setFees(feeJson.data || []);
      if (stuJson.success) {
        setStudents(stuJson.data || []);
        if (!selectedStudentId && stuJson.data?.length > 0) {
          setSelectedStudentId(stuJson.data[0].student_id);
          setSemester(stuJson.data[0].semester);
        }
      }
    } catch (err) {
      console.error('Failed to load fees', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const selectedStudent = students.find((s) => s.student_id === selectedStudentId);

  // Update suggested due date and semester when student selection changes
  useEffect(() => {
    if (selectedStudent) {
      setSemester(selectedStudent.semester);
      const isOdd = selectedStudent.semester % 2 !== 0;
      setDueDate(isOdd ? '2026-10-15' : '2026-04-15');
    }
  }, [selectedStudentId]);

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setCreating(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/students/${selectedStudent.student_id}/fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_session: academicSession.trim(),
          course: selectedStudent.course,
          semester: Number(semester),
          fee_type: feeType.trim(),
          amount: Number(amount),
          due_date: dueDate.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create fee obligation');
      }

      setIsModalOpen(false);
      await fetchFees();
      if (onFeeCreated) onFeeCreated();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create fee');
    } finally {
      setCreating(false);
    }
  };

  const filteredFees = fees.filter((f) => {
    if (filterCourse !== 'ALL' && !f.course?.toUpperCase().includes(filterCourse.toUpperCase())) {
      return false;
    }
    if (filterStatus !== 'ALL' && f.status !== filterStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Action Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Courses</option>
            <option value="BCA">BCA</option>
            <option value="BBA">BBA</option>
            <option value="B.Com">B.Com</option>
            <option value="BA">BA</option>
            <option value="B.Tech">B.Tech</option>
            <option value="MCA">MCA</option>
            <option value="MBA">MBA</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PAID">PAID</option>
            <option value="OVERDUE">OVERDUE</option>
          </select>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Fee Demand</span>
        </button>
      </div>

      {/* Fees Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Fee ID</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course & Sem</th>
                <th className="py-3 px-4">Fee Head</th>
                <th className="py-3 px-4 text-right">Demanded</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Due Balance</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading fee ledger records...
                  </td>
                </tr>
              ) : filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No fee demand records found.
                  </td>
                </tr>
              ) : (
                filteredFees.map((fee) => {
                  const student = students.find((s) => s.student_id === fee.student_id);
                  const isOdd = fee.semester % 2 !== 0;
                  return (
                    <tr key={fee.fee_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{fee.fee_id}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {student ? student.student_name : fee.student_id}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{fee.student_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{fee.course}</div>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${isOdd ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800'}`}>
                          Sem {fee.semester} ({isOdd ? 'Odd/Dec' : 'Even/June'})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{fee.fee_type}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{Number(fee.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        ₹{Number(fee.paid_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                        ₹{Number(fee.due_amount !== undefined ? fee.due_amount : fee.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{fee.due_date}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            fee.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : fee.status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {fee.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Fee Demand Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-base">Issue New Fee Demand</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFee} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.student_name} ({s.course} • Sem {s.semester}) — {s.enrollment_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={academicSession}
                    onChange={(e) => setAcademicSession(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                  <input
                    type="number"
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    min={1}
                    max={8}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fee Head</label>
                  <select
                    value={feeType}
                    onChange={(e) => setFeeType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="Tuition Fee">Tuition Fee</option>
                    <option value="Examination Fee">Examination Fee</option>
                    <option value="Library & Lab Fee">Library & Lab Fee</option>
                    <option value="Development Fee">Development Fee</option>
                    <option value="Hostel Fee">Hostel Fee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Due Date (Suggested: {semester % 2 !== 0 ? '15 Oct for Odd' : '15 Apr for Even'})
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 rounded-lg text-xs font-bold shadow-xs transition"
                >
                  {creating ? 'Issuing...' : 'Create Demand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
