export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta: {
    cached: boolean;
    fetchedAt: string;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
  otp?: string;
}

export interface LoginResponse {
  sessionId: string;
  student: {
    id: number;
    username: string;
    name: string;
  };
}

export interface AuthStatus {
  loggedIn: boolean;
  student?: {
    id: number;
    username: string;
    name: string;
    login: string;
    lastLogin: string;
    ip: string;
  };
}

export interface StudentProfile {
  id: number;
  username: string;
  names: {
    firstAr: string;
    fatherAr: string;
    motherAr: string;
    surnameAr: string;
    firstEn: string;
    fatherEn: string;
    motherEn: string;
    surnameEn: string;
    fullAr: string;
    fullEn: string;
  };
  birth: {
    date: string;
    place: string;
  };
  gender: string;
  maritalStatus: string;
  militaryStatus: string;
  nationality: string;
  sidNumber: string;
  contact: {
    country: string;
    city: string;
    address: string;
    phone: string;
    mobile: string;
    email: string;
  };
  registration: {
    date: string;
    term: string;
    status: string;
  };
  account: {
    id: number;
    currency: string;
    balance: number;
    status: string;
  };
  programs: string[];
  documents: string[];
}

export interface Semester {
  term: string;
  termCode?: string;
  year: string;
  gpa?: number;
  average?: number;
  courses: CourseGrade[];
}

export interface CourseGrade {
  code: string;
  name: string;
  chr: number;
  mark: number | null;
  letterGrade: string;
  gpaValue: number | null;
  status: string;
  term?: string;
  class?: string;
  specialStatus?: string;
  finalAttendance?: string;
  gradeSource?: 'derived';
  helped: boolean;
  weights?: GradeWeights;
  scores?: GradeScores;
}

export interface GradeWeights {
  e1: number;
  e2: number;
  e3: number;
  midterm: number;
  oral: number;
  practical: number;
  finalExam: number;
  total: number;
}

export interface GradeScores {
  e1: number | null;
  e2: number | null;
  e3: number | null;
  midterm: number | null;
  oral: number | null;
  practical: number | null;
  finalExam: number | null;
  total: number | null;
}

export interface CurrentAverage {
  program: string;
  specialization: string;
  studentTerm: string;
  average: number;
  gpa: number;
  literalGrade: string;
  completedPass: number;
  completedExempt: number;
  /** @deprecated Alias for completedExempt; E means exempt, not exam. */
  completedExam: number;
  chr: number;
  englishChr: number;
  engPt: number;
  courses: GradeEntry[];
}

export interface GradeEntry {
  status: string;
  courseCode: string;
  chr: number;
  mark: number | null;
  term: string;
  letterGrade: string;
  gpaValue: number | null;
  gradeSource?: 'portal' | 'unavailable';
}

export interface Payment {
  id: string;
  description: string;
  status: string;
  term: string;
  date: string;
  validator: string;
  amount: number;
  currency: string;
  specialAmount: number;
  program: string;
  forDelete: string;
  processStatus: string;
  link: string;
}

export interface EPaymentStatus {
  hasDue: boolean;
  message: string;
}

export interface ExamSchedule {
  program: number;
  term: number;
  exams: ExamEntry[];
}

export interface ExamEntry {
  course: string;
  class: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  telecenter: string;
}

export interface ExamOptions {
  programs: { value: string; label: string }[];
  terms: { value: string; label: string }[];
}

export interface Assessment {
  course: string;
  startTime: string;
  endTime: string;
  status: string;
  score: number | null;
  alert: string | null;
}

export interface StudentClass {
  course: string;
  term: string;
  class: string;
  tutor: string;
  email: string;
  sessionTime?: string;
}

export interface LectureEntry {
  course: string;
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  tutor: string;
  topic?: string;
}

export interface SelectOption { value: string; label: string }

export interface ClassScheduleEntry {
  sessionTime: string;
  class: string;
  tutorEmail: string;
  tutor: string;
  quota: string;
}

export interface TutorOptions {
  programs: { value: string; label: string }[];
  courses: { value: string; label: string }[];
  terms: { value: string; label: string }[];
}

export interface TutorEntry {
  course: string;
  class: string;
  tutor: string;
  percent: string;
  term: string;
  group?: string;
}

export interface TutorGroup {
  group: string;
  entries: TutorEntry[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SvuisHealth {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  cacheSize: number;
  sessionCount: number;
  svuisReachable: boolean;
  svuisCheckedAt?: string;
}

export interface ClassAssignProgram {
  value: string;
  label: string;
}

export interface ClassAssignCourse {
  code: string;
  chr: string;
  name: string;
  status: { letter: string; label: string; color: string }[];
}

export interface ClassAssignGroup {
  name: string;
  specialization: string;
  courses: ClassAssignCourse[];
}

export interface ClassAssignData {
  termId: string;
  studentId: string;
  programId: string;
  groups: ClassAssignGroup[];
}
