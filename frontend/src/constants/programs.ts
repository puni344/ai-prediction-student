export interface ProgramOption {
  id: string;
  name: string;
  fullName: string;
  durationYears: number;
}

export const PROGRAMS: ProgramOption[] = [
  { id: "btech", name: "B.Tech", fullName: "Bachelor of Technology", durationYears: 4 },
  { id: "be", name: "B.E.", fullName: "Bachelor of Engineering", durationYears: 4 },
  { id: "barch", name: "B.Arch", fullName: "Bachelor of Architecture", durationYears: 5 },
  { id: "bca", name: "BCA", fullName: "Bachelor of Computer Applications", durationYears: 3 },
  { id: "bsc", name: "B.Sc.", fullName: "Bachelor of Science", durationYears: 3 },
  { id: "ba", name: "B.A.", fullName: "Bachelor of Arts", durationYears: 3 },
  { id: "bcom", name: "B.Com", fullName: "Bachelor of Commerce", durationYears: 3 },
  { id: "mtech", name: "M.Tech", fullName: "Master of Technology", durationYears: 2 },
  { id: "me", name: "M.E.", fullName: "Master of Engineering", durationYears: 2 },
  { id: "march", name: "M.Arch", fullName: "Master of Architecture", durationYears: 2 },
  { id: "mca", name: "MCA", fullName: "Master of Computer Applications", durationYears: 2 },
  { id: "mba", name: "MBA", fullName: "Master of Business Administration", durationYears: 2 },
  { id: "msc", name: "M.Sc.", fullName: "Master of Science", durationYears: 2 },
  { id: "ma", name: "M.A.", fullName: "Master of Arts", durationYears: 2 },
  { id: "mcom", name: "M.Com", fullName: "Master of Commerce", durationYears: 2 },
  { id: "diploma", name: "Diploma", fullName: "Diploma Engineering / Polytechnic", durationYears: 3 },
  { id: "phd", name: "Ph.D.", fullName: "Doctor of Philosophy", durationYears: 5 },
  { id: "other", name: "Other", fullName: "Other Academic Program", durationYears: 4 },
];

export const getProgramByNameOrId = (val?: string | null): ProgramOption | undefined => {
  if (!val) return undefined;
  const clean = val.trim().toLowerCase();
  return PROGRAMS.find(
    (p) =>
      p.name.toLowerCase() === clean ||
      p.id.toLowerCase() === clean ||
      p.fullName.toLowerCase() === clean
  );
};

export const getProgramDuration = (programName?: string | null): number => {
  const p = getProgramByNameOrId(programName);
  return p ? p.durationYears : 4;
};

export const getYearOrdinal = (yearNum: number): string => {
  if (yearNum === 1) return "1st Year";
  if (yearNum === 2) return "2nd Year";
  if (yearNum === 3) return "3rd Year";
  return `${yearNum}th Year`;
};

export const getYearOptionsForProgram = (programName?: string | null): string[] => {
  const duration = getProgramDuration(programName);
  const years: string[] = [];
  for (let i = 1; i <= duration; i++) {
    years.push(getYearOrdinal(i));
  }
  return years;
};

export const isValidYearForProgram = (
  programName?: string | null,
  yearStr?: string | null
): boolean => {
  if (!programName || !yearStr) return false;
  const options = getYearOptionsForProgram(programName);
  return options.includes(yearStr.trim());
};
