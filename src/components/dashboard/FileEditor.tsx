import { useState, useEffect } from "react";
import { FileItem, UserProfile, TableContent, FileLock, FileVersion, ActivityLog } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, update, onValue, set, remove, get, push } from "firebase/database";
import { ChevronLeft, Save, Plus, Trash2, Table as TableIcon, FileText, Lock, Clock, History, RotateCcw, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import Button from "@/src/components/ui/Button";
import PromptModal from "@/src/components/ui/PromptModal";
import ContextMenu from "@/src/components/ui/ContextMenu";

interface FileEditorProps {
  file: FileItem;
  onBack: () => void;
  profile: UserProfile;
}

export default function FileEditor({ file, onBack, profile }: FileEditorProps) {
  const [content, setContent] = useState(file.content);
  const [isSaving, setIsSaving] = useState(false);
  const [lock, setLock] = useState<FileLock | null>(null);
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<FileVersion[]>(file.versions || []);

  useEffect(() => {
    const lockRef = ref(db, `locks/${profile.schoolId}/${file.id}`);
    
    // Acquire lock
    set(lockRef, {
      userId: profile.uid,
      userName: profile.name || "Anonymous",
      timestamp: Date.now()
    });

    // Refresh lock
    const interval = setInterval(() => {
      set(lockRef, {
        userId: profile.uid,
        userName: profile.name || "Anonymous",
        timestamp: Date.now()
      });
    }, 10000);

    // Listen for lock changes
    const unsubscribe = onValue(lockRef, (snapshot) => {
      const data = snapshot.val();
      setLock(data);
      if (data && data.userId !== profile.uid && (Date.now() - data.timestamp < 30000)) {
        setIsLockedByOther(true);
      } else {
        setIsLockedByOther(false);
      }
    });

    // Release lock on unmount
    return () => {
      clearInterval(interval);
      remove(lockRef);
      unsubscribe();
    };
  }, [file.id, profile.uid, profile.name, profile.schoolId]);

  const handleSave = async () => {
    if (isLockedByOther) return;
    setIsSaving(true);
    
    // Create new version
    const newVersion: FileVersion = {
      id: Math.random().toString(36).substring(7),
      content: file.content, // Save the OLD content as a version
      updatedAt: file.updatedAt,
      updatedBy: profile.uid,
      userName: profile.name || "Anonymous"
    };

    const updatedVersions = [newVersion, ...versions].slice(0, 7);
    setVersions(updatedVersions);

    const fileUpdate = {
      content,
      updatedAt: Date.now(),
      versions: updatedVersions
    };

    await update(ref(db, `files/${profile.schoolId}/${file.id}`), fileUpdate);
    
    // Log activity
    const activityRef = ref(db, `activity/${profile.schoolId}/${profile.uid}`);
    const newActivityRef = push(activityRef);
    const activity: ActivityLog = {
      id: newActivityRef.key!,
      userId: profile.uid,
      userName: profile.name || "Anonymous",
      action: "edit",
      targetName: file.name,
      targetType: file.type,
      timestamp: Date.now()
    };
    await set(newActivityRef, activity);

    // Also update user's last log
    await update(ref(db, `users/${profile.uid}`), {
      lastDataLog: Date.now(),
      totalLogsThisWeek: (profile.totalLogsThisWeek || 0) + 1
    });
    
    setIsSaving(false);
  };

  const restoreVersion = (version: FileVersion) => {
    setContent(version.content);
    setShowVersions(false);
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      <header className="px-8 py-4 border-b border-neutral-50 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-4 overflow-hidden">
          <button onClick={onBack} className="p-2 hover:bg-neutral-50 rounded-full transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 overflow-hidden">
              {file.type === "table" ? <TableIcon className="w-4 h-4 text-neutral-400 shrink-0" /> : <FileText className="w-4 h-4 text-neutral-400 shrink-0" />}
              <h2 className="font-bold truncate whitespace-nowrap">{file.name}</h2>
            </div>
            <p className="text-[9px] text-neutral-400 uppercase tracking-wider font-bold truncate">
              Last updated {new Date(file.updatedAt).toLocaleTimeString()}
            </p>
          </div>
          {isLockedByOther && (
            <div className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {lock?.userName} is editing
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowVersions(!showVersions)}
            className={cn(
              "p-2 rounded-xl transition-all",
              showVersions ? "bg-black text-white" : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
            )}
            title="Version History"
          >
            <Clock className="w-5 h-5" />
          </button>
          <Button onClick={handleSave} disabled={isSaving || isLockedByOther} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        {file.type === "table" ? (
          <TableEditor content={content as TableContent} setContent={setContent} disabled={isLockedByOther} />
        ) : (
          <TextEditor content={content as string} setContent={setContent} disabled={isLockedByOther} />
        )}
      </div>

      {/* Version History Popup */}
      <AnimatePresence>
        {showVersions && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-8 w-80 bg-white border border-neutral-100 shadow-2xl rounded-3xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-neutral-50 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-neutral-400" />
                <span className="text-sm font-bold">Version History</span>
              </div>
              <button onClick={() => setShowVersions(false)} className="p-1 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 max-h-[400px]">
              {versions.length === 0 ? (
                <div className="p-8 text-center text-neutral-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No previous versions found</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {versions.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => restoreVersion(v)}
                      className="w-full p-3 text-left hover:bg-neutral-50 rounded-2xl transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          {i === 0 ? "Previous Version" : `Version ${versions.length - i}`}
                        </span>
                        <RotateCcw className="w-3 h-3 text-neutral-300 group-hover:text-black transition-colors" />
                      </div>
                      <p className="text-xs font-bold text-black">{new Date(v.updatedAt).toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Edited by {v.userName}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-neutral-50/50 border-t border-neutral-50">
              <p className="text-[9px] text-neutral-400 font-medium leading-tight">
                Restoring a version will replace your current unsaved changes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TableEditor({ content, setContent, disabled }: { content: TableContent; setContent: (c: TableContent) => void; disabled: boolean }) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const columns = content?.columns || [];
  const rows = content?.rows || [];

  const addRow = () => {
    if (disabled) return;
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col.id]: "" }), { id: Math.random().toString(36).substring(7) });
    setContent({ ...content, columns, rows: [...rows, newRow] });
  };

  const handleAddColumn = (name: string) => {
    if (disabled) return;
    const id = "c" + (columns.length + 1);
    setContent({
      ...content,
      columns: [...columns, { id, name }],
      rows: rows.map(r => ({ ...r, [id]: "" }))
    });
    setIsPromptOpen(false);
  };

  const updateCell = (rowIndex: number, colId: string, value: string) => {
    if (disabled) return;
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: value };
    setContent({ ...content, columns, rows: newRows });
  };

  const deleteRow = (index: number) => {
    if (disabled) return;
    setContent({ ...content, columns, rows: rows.filter((_, i) => i !== index) });
  };

  const deleteColumn = (colId: string) => {
    if (disabled) return;
    if (columns.length <= 1) return; // Keep at least one column
    const newColumns = columns.filter(c => c.id !== colId);
    const newRows = rows.map(r => {
      const { [colId]: _, ...rest } = r;
      return rest;
    });
    setContent({ ...content, columns: newColumns, rows: newRows });
  };

  const duplicateRow = (index: number) => {
    if (disabled) return;
    const rowToDuplicate = rows[index];
    const newRow = { ...rowToDuplicate, id: Math.random().toString(36).substring(7) };
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    setContent({ ...content, columns, rows: newRows });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (e.key === "ArrowDown") nextRow = Math.min(rows.length - 1, rowIndex + 1);
    else if (e.key === "ArrowUp") nextRow = Math.max(0, rowIndex - 1);
    else if (e.key === "ArrowRight" && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) nextCol = Math.min(columns.length - 1, colIndex + 1);
    else if (e.key === "ArrowLeft" && (e.target as HTMLInputElement).selectionStart === 0) nextCol = Math.max(0, colIndex - 1);
    else return;

    if (nextRow !== rowIndex || nextCol !== colIndex) {
      e.preventDefault();
      const nextInput = document.getElementById(`cell-${nextRow}-${nextCol}`);
      if (nextInput) nextInput.focus();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PromptModal
        isOpen={isPromptOpen}
        title="Add Column"
        placeholder="Column name"
        onConfirm={handleAddColumn}
        onCancel={() => setIsPromptOpen(false)}
      />
      <div className="overflow-x-auto border border-neutral-200 rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              {columns.map((col) => (
                <th key={col.id} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 border-r border-neutral-200 min-w-[150px] last:border-r-0 group/col relative">
                  <div className="flex items-center justify-between">
                    <span>{col.name}</span>
                    <button 
                      onClick={() => deleteColumn(col.id)}
                      disabled={disabled || columns.length <= 1}
                      className="opacity-0 group-hover/col:opacity-100 p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <ContextMenu
                key={row.id}
                as="tr"
                className="group hover:bg-neutral-50 transition-colors border-b border-neutral-200 last:border-b-0"
                items={[
                  { label: "Duplicate Row", icon: <FileText className="w-4 h-4" />, onClick: () => duplicateRow(rowIndex) },
                  { label: "Delete Row", icon: <Trash2 className="w-4 h-4" />, onClick: () => deleteRow(rowIndex), variant: "danger" }
                ]}
              >
                {columns.map((col, colIndex) => (
                  <td key={col.id} className="p-0 border-r border-neutral-200 last:border-r-0 relative">
                    <input
                      id={`cell-${rowIndex}-${colIndex}`}
                      type="text"
                      value={row[col.id] || ""}
                      onChange={(e) => updateCell(rowIndex, col.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                      className="w-full h-full min-h-[40px] bg-transparent outline-none text-sm px-4 py-2 focus:bg-white focus:ring-2 focus:ring-black focus:ring-inset transition-all"
                    />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <button onClick={() => deleteRow(rowIndex)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </ContextMenu>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4">
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-100 hover:border-neutral-200 text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> Add Row
        </button>
        <button onClick={() => setIsPromptOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-100 hover:border-neutral-200 text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> Add Column
        </button>
      </div>
    </div>
  );
}

function TextEditor({ content, setContent, disabled }: { content: string; setContent: (c: string) => void; disabled: boolean }) {
  return (
    <textarea
      value={content}
      disabled={disabled}
      onChange={(e) => setContent(e.target.value)}
      placeholder="Start typing..."
      className="w-full h-full min-h-[500px] bg-transparent outline-none text-lg leading-relaxed resize-none placeholder:text-neutral-200"
    />
  );
}
