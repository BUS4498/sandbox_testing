"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Download, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ArchiveRecord = { id: string; createdAt: string; opportunityCount: number; wordFileCount: number; byteSize: number };

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function ResetCollection({ available, preview, disabled, onReset }: { available: boolean; preview: boolean; disabled: boolean; onReset: () => Promise<void> }) {
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loadArchives = useCallback(async () => {
    const response = await fetch("/api/reset-archives", { cache: "no-store" });
    const body = await response.json() as { archives?: ArchiveRecord[]; error?: string };
    if (!response.ok) throw new Error(body.error || "Recovery archives could not be listed.");
    setArchives(body.archives ?? []);
  }, []);
  useEffect(() => {
    if (!open || !available) return;
    const timer = setTimeout(() => { void loadArchives().catch(() => setError("Recovery archives could not be listed right now.")); }, 0);
    return () => clearTimeout(timer);
  }, [available, loadArchives, open]);

  async function reset() {
    if (confirmation !== "RESET" || disabled || working) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/reset-collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const body = await response.json() as { result?: { archive: ArchiveRecord; retiredWordFilesPending: number }; error?: string };
      if (!response.ok && response.status !== 207) throw new Error(body.error || "The reset could not be verified.");
      if (!body.result) throw new Error("The reset result could not be verified.");
      setConfirmation("");
      setMessage(`Active collection cleared. Recovery archive created ${displayDate(body.result.archive.createdAt)}. Download it below.${body.result.retiredWordFilesPending ? ` ${body.result.retiredWordFilesPending} retired Word file(s) need storage cleanup; the archive remains available.` : ""}`);
      await Promise.all([loadArchives(), onReset()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reset could not be completed.");
      await Promise.allSettled([loadArchives(), onReset()]);
    } finally { setWorking(false); }
  }

  async function removeArchive(id: string) {
    if (deleteConfirmation !== "DELETE" || disabled || working) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/reset-archives/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "The archive could not be deleted.");
      setDeletingId(null); setDeleteConfirmation("");
      setMessage("The selected recovery archive was permanently deleted.");
      await loadArchives();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The archive could not be deleted."); }
    finally { setWorking(false); }
  }

  return <div className="reset-collection">
    <Dialog open={open} onOpenChange={(nextOpen) => { if (working) return; setOpen(nextOpen); if (!nextOpen) { setConfirmation(""); setDeletingId(null); } setError(""); }}>
      <DialogTrigger asChild><button type="button" className="reset-toggle" disabled={disabled || working || !available} title={!available ? preview ? "Reset is disabled in this visual preview." : "Private archive storage is unavailable; nothing can be cleared safely." : "Archive your current collection before clearing it"}><Archive size={16} /> Reset Collection</button></DialogTrigger>
      <DialogContent className="reset-dialog" showCloseButton={!working} onEscapeKeyDown={(event) => { if (working) event.preventDefault(); }} onPointerDownOutside={(event) => { if (working) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Reset Collection</DialogTitle><DialogDescription>Archive and clear your current opportunities. This is separate from Collect and does not call the AI model or change your saved student setup.</DialogDescription></DialogHeader>
        <div className="reset-panel">
      <strong>Archive, then clear the active collection</strong>
      <ul>
        <li>A private downloadable ZIP will preserve current opportunities, related runs and activity, saved responses, and Word drafts.</li>
        <li>After the ZIP passes read-back verification, the active opportunities and their history will be cleared.</li>
        <li>Your student setup and API configuration remain. Earlier archives remain until you explicitly delete them.</li>
        <li>Previously submitted external messages cannot be recalled. One-click restore is not available.</li>
      </ul>
      <label>Type RESET to confirm<input autoComplete="off" spellCheck={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESET" disabled={working || disabled} /></label>
      <div className="reset-actions"><button type="button" onClick={() => { setOpen(false); setConfirmation(""); }} disabled={working}>Cancel</button><button type="button" className="reset-confirm" onClick={reset} disabled={confirmation !== "RESET" || disabled || working}>{working ? "Archiving and verifying…" : "Archive and Reset"}</button></div>
        </div>
    {message && <p className="reset-message" role="status">{message}</p>}
    {error && <p className="reset-error" role="alert">{error}</p>}
    {archives.length > 0 && <div className="archive-list"><h3>Private recovery archives</h3><p>These files are retained until you delete them. Keep any downloaded copy private.</p><ul>{archives.map((archive) => <li key={archive.id}>
      <span><strong>{displayDate(archive.createdAt)}</strong><small>{archive.opportunityCount} opportunities · {archive.wordFileCount} Word drafts · {Math.max(1, Math.round(archive.byteSize / 1024))} KB</small></span>
      <a href={`/api/reset-archives/${encodeURIComponent(archive.id)}`} className="archive-download"><Download size={15} /> Download ZIP</a>
      <button type="button" className="archive-delete" onClick={() => { setDeletingId(deletingId === archive.id ? null : archive.id); setDeleteConfirmation(""); }} disabled={disabled || working}><Trash2 size={15} /> Delete</button>
      {deletingId === archive.id && <div className="archive-delete-confirm"><label>Type DELETE to remove this archive permanently<input autoComplete="off" spellCheck={false} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={working || disabled} /></label><button type="button" onClick={() => void removeArchive(archive.id)} disabled={deleteConfirmation !== "DELETE" || disabled || working}>Delete archive</button></div>}
    </li>)}</ul></div>}
      </DialogContent>
    </Dialog>
    {!available && !preview && <span className="reset-unavailable" role="status">Archive storage unavailable</span>}
  </div>;
}
