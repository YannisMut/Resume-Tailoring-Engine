import type { ResumeStructure } from '@resume/types';

// Type-level check: confirm @resume/types is importable and ResumeStructure has layout fields.
// This is a compile-time validation only — no runtime effect.
type _LayoutCheck = ResumeStructure['meta']['marginTop']; // must be number — fails TS if type is missing

export default function Home() {
  return (
    <main>
      <h1>Resume Tailoring Engine</h1>
      <p>Upload your resume PDF and a job description to get started.</p>
      <p>
        <em>Coming soon: Step 1 — Upload resume and paste job description.</em>
      </p>
    </main>
  );
}
