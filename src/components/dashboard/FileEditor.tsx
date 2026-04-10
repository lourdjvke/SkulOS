import { useState, useEffect } from "react";
import { FileItem, UserProfile, TableContent } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, update } from "firebase/database";
import { ChevronLeft, Save, Plus, Trash2, Table as TableIcon, FileText } from "lucide-react";
import { motion } from "motion/react";
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

  const handleSave = async () => {
    setIsSaving(true);
    await update(ref(db, `files/${profile.schoolId}/${file.id}`), {
      content,
      updatedAt: Date.now()
    });
    // Also update user's last log
    await update(ref(db, `users/${profile.uid}`), {
      lastDataLog: Date.now(),
      totalLogsThisWeek: (profile.totalLogsThisWeek || 0) + 1
    });
    setIsSaving(false);
  };

  return (
    <div className="h-full flex flex-col bg-white">
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
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-8">
        {file.type === "table" ? (
          <TableEditor content={content as TableContent} setContent={setContent} />
        ) : (
          <TextEditor content={content as string} setContent={setContent} />
        )}
      </div>
    </div>
  );
}

function TableEditor({ content, setContent }: { content: TableContent; setContent: (c: TableContent) => void }) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const columns = content?.columns || [];
  const rows = content?.rows || [];

  const addRow = () => {
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col.id]: "" }), { id: Math.random().toString(36).substring(7) });
    setContent({ ...content, columns, rows: [...rows, newRow] });
  };

  const handleAddColumn = (name: string) => {
    const id = "c" + (columns.length + 1);
    setContent({
      ...content,
      columns: [...columns, { id, name }],
      rows: rows.map(r => ({ ...r, [id]: "" }))
    });
    setIsPromptOpen(false);
  };

  const updateCell = (rowIndex: number, colId: string, value: string) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: value };
    setContent({ ...content, columns, rows: newRows });
  };

  const deleteRow = (index: number) => {
    setContent({ ...content, columns, rows: rows.filter((_, i) => i !== index) });
  };

  const duplicateRow = (index: number) => {
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
                <th key={col.id} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 border-r border-neutral-200 min-w-[150px] last:border-r-0">
                  {col.name}
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

function TextEditor({ content, setContent }: { content: string; setContent: (c: string) => void }) {
  return (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      placeholder="Start typing..."
      className="w-full h-full min-h-[500px] bg-transparent outline-none text-lg leading-relaxed resize-none placeholder:text-neutral-200"
    />
  );
}
