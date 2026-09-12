/**
 * GIIT Academic Course & Semester Structure Constants
 * 
 * Course Structure:
 * BCA    -> 6 semesters -> 3 years
 * BBA    -> 6 semesters -> 3 years
 * B.Com  -> 6 semesters -> 3 years
 * BA     -> 6 semesters -> 3 years
 * B.Tech -> 8 semesters -> 4 years
 * MCA    -> 4 semesters -> 2 years
 * MBA    -> 4 semesters -> 2 years
 */

export interface CourseDefinition {
  code: string;
  name: string;
  total_semesters: number;
  duration_years: number;
  default_annual_fee: number;
}

export const COURSE_DEFINITIONS: Record<string, CourseDefinition> = {
  'BCA': {
    code: 'BCA',
    name: 'Bachelor of Computer Applications (BCA)',
    total_semesters: 6,
    duration_years: 3,
    default_annual_fee: 70000,
  },
  'BBA': {
    code: 'BBA',
    name: 'Bachelor of Business Administration (BBA)',
    total_semesters: 6,
    duration_years: 3,
    default_annual_fee: 70000,
  },
  'B.Com': {
    code: 'B.Com',
    name: 'Bachelor of Commerce (B.Com)',
    total_semesters: 6,
    duration_years: 3,
    default_annual_fee: 50000,
  },
  'BA': {
    code: 'BA',
    name: 'Bachelor of Arts (BA)',
    total_semesters: 6,
    duration_years: 3,
    default_annual_fee: 40000,
  },
  'B.Tech': {
    code: 'B.Tech',
    name: 'Bachelor of Technology (B.Tech)',
    total_semesters: 8,
    duration_years: 4,
    default_annual_fee: 95000,
  },
  'MCA': {
    code: 'MCA',
    name: 'Master of Computer Applications (MCA)',
    total_semesters: 4,
    duration_years: 2,
    default_annual_fee: 80000,
  },
  'MBA': {
    code: 'MBA',
    name: 'Master of Business Administration (MBA)',
    total_semesters: 4,
    duration_years: 2,
    default_annual_fee: 90000,
  },
};

export const ALLOWED_COURSES = Object.keys(COURSE_DEFINITIONS);

/**
 * Normalizes course name string (e.g. 'B.Tech Computer Science' -> 'B.Tech')
 * Keeps backwards compatibility with existing stored strings while validating.
 */
export function normalizeCourseCode(courseInput: string): string | null {
  if (!courseInput) return null;
  const trimmed = courseInput.trim();

  // Direct match
  if (COURSE_DEFINITIONS[trimmed]) {
    return trimmed;
  }

  // Case-insensitive match
  const upper = trimmed.toUpperCase();
  for (const code of ALLOWED_COURSES) {
    if (code.toUpperCase() === upper) {
      return code;
    }
  }

  // Prefix or containment match (e.g. 'B.Tech CSE' -> 'B.Tech')
  if (upper.startsWith('B.TECH') || upper.startsWith('BTECH')) return 'B.Tech';
  if (upper.startsWith('BCA')) return 'BCA';
  if (upper.startsWith('BBA')) return 'BBA';
  if (upper.startsWith('B.COM') || upper.startsWith('BCOM')) return 'B.Com';
  if (upper.startsWith('BA ') || upper === 'BA') return 'BA';
  if (upper.startsWith('MCA')) return 'MCA';
  if (upper.startsWith('MBA')) return 'MBA';

  return null;
}

/**
 * Returns maximum allowed semesters for a given course.
 */
export function getMaxSemestersForCourse(courseInput: string): number {
  const code = normalizeCourseCode(courseInput);
  if (!code) return 6; // default safe fallback
  return COURSE_DEFINITIONS[code]?.total_semesters || 6;
}

/**
 * Validates course and semester combination.
 */
export function validateCourseAndSemester(
  courseInput: string,
  semester: number
): { valid: boolean; normalizedCourse: string; maxSemesters: number; error?: string } {
  const normalized = normalizeCourseCode(courseInput);
  if (!normalized) {
    return {
      valid: false,
      normalizedCourse: courseInput,
      maxSemesters: 6,
      error: `Invalid course '${courseInput}'. Allowed courses are: ${ALLOWED_COURSES.join(', ')}`,
    };
  }

  const maxSemesters = COURSE_DEFINITIONS[normalized].total_semesters;
  const semNum = Number(semester);

  if (isNaN(semNum) || !Number.isInteger(semNum) || semNum < 1 || semNum > maxSemesters) {
    return {
      valid: false,
      normalizedCourse: normalized,
      maxSemesters,
      error: `Invalid semester ${semester} for course '${normalized}'. Course '${normalized}' only has semesters 1 to ${maxSemesters}.`,
    };
  }

  return {
    valid: true,
    normalizedCourse: normalized,
    maxSemesters,
  };
}

/**
 * Odd / Even Semester Cycle Helper
 * 
 * Odd Semesters: 1, 3, 5, 7 -> Odd Semester Cycle (December)
 *   - Advance payment window due: 15 October
 * Even Semesters: 2, 4, 6, 8 -> Even Semester Cycle (June)
 *   - Advance payment window due: 15 April
 */
export interface CycleInfo {
  semester: number;
  cycle_type: 'ODD' | 'EVEN';
  cycle_name: string;
  session_cycle_label: string;
  advance_due_date_str: string;
}

export function getSemesterCycleInfo(semester: number, year: number = new Date().getFullYear()): CycleInfo {
  const semNum = Number(semester);
  const isOdd = semNum % 2 !== 0;

  if (isOdd) {
    return {
      semester: semNum,
      cycle_type: 'ODD',
      cycle_name: 'Odd Semester Cycle (December)',
      session_cycle_label: `Odd Sem (${semNum}) - Dec Exam Cycle`,
      advance_due_date_str: `${year}-10-15`, // 15 October
    };
  } else {
    return {
      semester: semNum,
      cycle_type: 'EVEN',
      cycle_name: 'Even Semester Cycle (June)',
      session_cycle_label: `Even Sem (${semNum}) - June Exam Cycle`,
      advance_due_date_str: `${year}-04-15`, // 15 April
    };
  }
}

/**
 * Calculates next payment cycle details for a student
 */
export function getNextPaymentCycle(currentSemester: number, maxSemesters: number, currentYear: number = new Date().getFullYear()): {
  next_semester: number | null;
  next_cycle_type: 'ODD' | 'EVEN' | 'COMPLETED';
  next_cycle_name: string;
  next_due_date: string;
  is_last_semester: boolean;
} {
  const current = Number(currentSemester);
  if (current >= maxSemesters) {
    return {
      next_semester: null,
      next_cycle_type: 'COMPLETED',
      next_cycle_name: 'Program Complete (Final Semester)',
      next_due_date: 'N/A',
      is_last_semester: true,
    };
  }

  const nextSem = current + 1;
  const isNextOdd = nextSem % 2 !== 0;
  // If next is Odd, advance is due 15 October of previous or same year
  // If next is Even, advance is due 15 April
  const dueDate = isNextOdd ? `${currentYear}-10-15` : `${currentYear}-04-15`;

  return {
    next_semester: nextSem,
    next_cycle_type: isNextOdd ? 'ODD' : 'EVEN',
    next_cycle_name: isNextOdd ? 'Odd Semester Cycle (December)' : 'Even Semester Cycle (June)',
    next_due_date: dueDate,
    is_last_semester: false,
  };
}
