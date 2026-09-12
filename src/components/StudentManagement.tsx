import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, User, GraduationCap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Student } from '../types';

interface StudentManagementProps {
  onSelectStudent: (studentId: string) => void;
  onOpenAddModal: () => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  onSelectStudent,
  onOpenAddModal,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const url = searchTerm ? `/api/students/search?q=${encodeURIComponent(searchTerm)}` : '/api/students';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setStudents(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchTerm]);

  const filteredStudents = students.filter((stu) => {
    if (courseFilter === 'ALL') return true;
    return stu.course.toUpperCase().includes(courseFilter.toUpperCase());
  });

  return (
    <div className="space-y-5">
      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or enrollment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden"
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
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Register Student</span>
        </button>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student Name & ID</th>
                <th className="py-3 px-4">Enrollment Number</th>
                <th className="py-3 px-4">Course & Program</th>
                <th className="py-3 px-4">Semester & Cycle</th>
                <th className="py-3 px-4">Session</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading student records...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No students found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const isOdd = stu.semester % 2 !== 0;
                  return (
                    <tr key={stu.student_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{stu.student_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{stu.student_id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {stu.enrollment_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{stu.course}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-800">Sem {stu.semester}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${isOdd ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800'}`}>
                            {isOdd ? 'Odd' : 'Even'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{stu.academic_session}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{stu.mobile}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectStudent(stu.student_id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-semibold rounded-lg text-xs transition inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <span>View Fee Status</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
