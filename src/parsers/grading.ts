/** Observed on std_current_average.php, 2026-10-31. Derived values only;
 * course status and the official cumulative GPA must come from the portal. */
const scale = [
  [98, 'A+', 4], [95, 'A', 3.75], [90, 'A-', 3.5],
  [85, 'B+', 3.25], [80, 'B', 3], [75, 'B-', 2.75],
  [70, 'C+', 2.5], [65, 'C', 2.25], [60, 'C-', 2],
  [55, 'D+', 1.75], [50, 'D', 1.5], [0, 'E/F', 0],
] as const;

export function derivedGrade(mark: number | null): { letterGrade: string; gpaValue: number | null } {
  if (mark === null || mark < 0 || mark > 100) return { letterGrade: '', gpaValue: null };
  const [, letterGrade, gpaValue] = scale.find(([min]) => mark >= min)!;
  return { letterGrade, gpaValue };
}
