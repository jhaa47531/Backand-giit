import React, { useState, useEffect } from 'react';
import { X, UserPlus, GraduationCap, Calendar, DollarSign, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { CourseDefinition } from '../types';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
}

const COURSES_INFO: Record<string, { total_semesters: number; duration_years: number; default_annual_fee: number; label: string }> = {
  'BCA': { total_semesters: 6, duration_years: 3, default_annual_fee: 70000, label: 'BCA (6 Semesters • 3 Years)' },
  'BBA': { total_semesters: 6, duration_years: 3, default_annual_fee: 70000, label: 'BBA (6 Semesters • 3 Years)' },
  'B.Com': { total_semesters: 6, duration_years: 3, default_annual_fee: 50000, label: 'B.Com (6 Semesters • 3 Years)' },
  'BA': { total_semesters: 6, duration_years: 3, default_annual_fee: 40000, label: 'BA (6 Semesters • 3 Years)' },
  'B.Tech': { total_semesters: 8, duration_years: 4, default_annual_fee: 95000, label: 'B.Tech (8 Semesters • 4 Years)' },
  'MCA': { total_semesters: 4, duration_years: 2, default_annual_fee: 80000, label: 'MCA (4 Semesters • 2 Years)' },
  'MBA': { total_semesters: 4, duration_years: 2, default_annual_fee: 90000, label: 'MBA (4 Semesters • 2 Years)' },
};

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onStudentAdded }) => {
  const [course, setCourse] = useState<string>('BCA');
  const [semester, setSemester] = useState<number>(1);
  const [enrollmentNumber, setEnrollmentNumber] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [fatherName, setFatherName] = useState<string>('');
  const [motherName, setMotherName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [academicSession, setAcademicSession] = useState<string>('2026-2027');
  const [totalCourseFee, setTotalCourseFee] = useState<number>(210000); // 70k * 3 years
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // When course changes, adjust semester if it exceeds course's max
  const courseConfig = COURSES_INFO[course] || COURSES_INFO['BCA'];
  const maxSemesters = courseConfig.total_semesters;

  useEffect(() => {
    if (semester > maxSemesters) {
      setSemester(1);
    }
    // Update default total course fee
    setTotalCourseFee(courseConfig.default_annual_fee * courseConfig.duration_years);
  }, [course]);

  if (!isOpen) return null;

  // Calculate annual fee and installments
  const annualFee = Math.round(totalCourseFee / courseConfig.duration_years);
  const installment1 = Math.round(annualFee / 2);
  const installment2 = annualFee - installment1;

  // Cycle determination
  const isOddCycle = semester % 2 !== 0;
  const cycleName = isOddCycle ? 'Odd Semester Cycle (December)' : 'Even Semester Cycle (June)';
  const advanceDueDate = isOddCycle ? '15 October' : '15 April';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!enrollmentNumber.trim() || !studentName.trim()) {
      setError('Enrollment Number and Student Name are required.');
      return;
    }

    if (semester < 1 || semester > maxSemesters) {
      setError(`Invalid semester ${semester} for course '${course}'. Course '${course}' only has semesters 1 to ${maxSemesters}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_number: enrollmentNumber.trim(),
          student_name: studentName.trim(),
          father_name: fatherName.trim() || undefined,
          mother_name: motherName.trim() || undefined,
          course: course.trim(),
          semester: Number(semester),
          academic_session: academicSession.trim(),
          mobile: mobile.trim() || '9800000000',
          email: email.trim() || undefined,
          total_course_fee: Number(totalCourseFee),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register student');
      }

      setSuccessMsg(`Student registered successfully with Student ID: ${data.data?.student?.student_id}`);
      setTimeout(() => {
        onStudentAdded();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to register student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-base">Register New Student</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Course & Semester Selection with Real-time Cycle Feedback */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Academic Program & Cycle Structure
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isOddCycle ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'}`}>
                {cycleName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Course <span className="text-rose-500">*</span>
                </label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {Object.entries(COURSES_INFO).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Current Semester <span className="text-rose-500">*</span> (1 to {maxSemesters})
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {Array.from({ length: maxSemesters }, (_, i) => i + 1).map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem} — {sem % 2 !== 0 ? 'Odd (Dec Cycle)' : 'Even (June Cycle)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Installment Structure Breakdown Preview */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Estimated Annual Fee</span>
                <span className="font-bold text-slate-800">₹{annualFee.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Odd Sem (50% Due 15 Oct)</span>
                <span className="font-bold text-indigo-700">₹{installment1.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Even Sem (50% Due 15 Apr)</span>
                <span className="font-bold text-amber-700">₹{installment2.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Student Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Enrollment Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. GIIT-BCA-2026-042"
                value={enrollmentNumber}
                onChange={(e) => setEnrollmentNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Student Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Riya Verma"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Father's Name</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Verma"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Academic Session</label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Total Course Fee (₹)</label>
              <input
                type="number"
                value={totalCourseFee}
                onChange={(e) => setTotalCourseFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 rounded-lg text-sm font-bold shadow-xs transition"
            >
              {loading ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
