"use client";
import StudentSetupCard from "../student-setup";

export default function RoleSuggestionsPreview() {
  return <main className="desk-shell"><p className="preview-nav">Synthetic interaction preview only. No model calls, saved setup changes, or Collect runs.</p>
    <StudentSetupCard preview disabled={false} onSaved={async () => undefined} setup={{ mode: "UNSELECTED", ready: false,
      profileText: "B.S. Business Administration, Information Systems concentration.\nMapped a campus business process and summarized results using Excel.\nBuilt a SQL-based reporting dashboard for an academic project.",
      preferences: null, confirmedAt: null, updatedAt: null }} />
  </main>;
}
