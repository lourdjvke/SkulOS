import { useState, useEffect, useRef } from "react";
import { UserProfile, FileItem, FileType, ACCENT_COLORS } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { Folder, FileText, Table as TableIcon, Plus, ChevronRight, MoreVertical, Search, Tag as TagIcon, Users } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { cn } from "@/src/lib/utils";
import ContextMenu from "@/src/components/ui/ContextMenu";
import FileEditor from "./FileEditor";
import PromptModal from "@/src/components/ui/PromptModal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

interface WorkspaceProps {
  profile: UserProfile;
  onPathChange: (path: string[]) => void;
  viewingStaffId?: string;
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
}

export default function Workspace({ profile, onPathChange, viewingStaffId, currentFolderId, setCurrentFolderId }: WorkspaceProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [loading, setLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  
  const [createModalState, setCreateModalState] = useState<{ isOpen: boolean; type: FileType | null }>({ isOpen: false, type: null });
  const [renameModalState, setRenameModalState] = useState<{ isOpen: boolean; fileId: string | null; currentName: string }>({ isOpen: false, fileId: null, currentName: "" });
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; fileId: string | null }>({ isOpen: false, fileId: null });

  const targetUserId = viewingStaffId || profile.uid;

  useEffect(() => {
    const filesRef = ref(db, `files/${profile.schoolId}`);
    const unsubscribe = onValue(filesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fileList = Object.values(data) as FileItem[];
        setFiles(fileList.filter(f => f.ownerId === targetUserId));
      } else {
        setFiles([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile.schoolId, targetUserId]);

  useEffect(() => {
    // Update breadcrumbs
    const path: string[] = [];
    let currId = currentFolderId;
    while (currId) {
      const folder = files.find(f => f.id === currId);
      if (folder) {
        path.unshift(folder.name);
        currId = folder.parentId;
      } else break;
    }
    onPathChange(path);
  }, [currentFolderId, files]);

  const createItem = async (type: FileType, name: string = "Untitled") => {
    if (!profile.schoolId) return;
    
    setLoading(true);
    try {
      const filesRef = ref(db, `files/${profile.schoolId}`);
      const newFileRef = push(filesRef);
      const id = newFileRef.key!;
      
      const newFile: FileItem = {
        id,
        name,
        type,
        parentId: currentFolderId,
        ownerId: targetUserId,
        schoolId: profile.schoolId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: type === "table" ? { columns: [{ id: "c1", name: "Name" }], rows: [] } : ""
      };

      await set(newFileRef, newFile);
      setShowCreateMenu(false);
    } catch (err) {
      console.error("Error creating item:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    await remove(ref(db, `files/${profile.schoolId}/${id}`));
  };

  const shareItem = async (id: string, email: string) => {
    // Find user by email
    const usersRef = ref(db, "users");
    onValue(usersRef, (snapshot) => {
      const users = snapshot.val();
      const user = Object.values(users as UserProfile[]).find(u => u.email === email);
      if (user) {
        const fileRef = ref(db, `files/${profile.schoolId}/${id}`);
        update(fileRef, { sharedWith: [...(files.find(f => f.id === id)?.sharedWith || []), user.uid] });
      }
    }, { onlyOnce: true });
  };

  const exportItem = (file: FileItem) => {
    if (file.type === "text") {
      const blob = new Blob([file.content as string], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name}.txt`;
      a.click();
    } else if (file.type === "table") {
      const content = file.content as { columns: { id: string, name: string }[], rows: any[] };
      const csv = [
        content.columns.map(c => c.name).join(","),
        ...content.rows.map(r => content.columns.map(c => r[c.id]).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name}.csv`;
      a.click();
    }
  };

  const duplicateItem = async (file: FileItem) => {
    if (!profile.schoolId) return;
    try {
      const newRef = push(ref(db, `files/${profile.schoolId}`));
      const newId = newRef.key!;
      const newFile = {
        ...file,
        id: newId,
        name: `${file.name} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await set(newRef, newFile);
    } catch (err) {
      console.error("Error duplicating item:", err);
    }
  };

  const updateTags = async (id: string, tags: string[]) => {
    await set(ref(db, `files/${profile.schoolId}/${id}/tags`), tags.length > 0 ? tags : null);
  };

  const renameItem = async (id: string, newName: string) => {
    await update(ref(db, `files/${profile.schoolId}/${id}`), { name: newName, updatedAt: Date.now() });
  };

  const filteredFiles = files
    .filter(f => 
      (f.parentId || null) === currentFolderId && 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (!selectedTag || (f.tags && f.tags.includes(selectedTag)))
    )
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return b.createdAt - a.createdAt;
    });

  if (selectedFile) {
    return <FileEditor file={selectedFile} onBack={() => setSelectedFile(null)} profile={profile} />;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="px-4 md:px-8 py-4 md:py-6 border-b border-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <button onClick={() => setCurrentFolderId(null)} className="hover:text-black transition-colors">Root</button>
            {currentFolderId && <ChevronRight className="w-3 h-3" />}
          </div>
          <h2 className="text-lg md:text-xl font-bold truncate">
            {currentFolderId ? files.find(f => f.id === currentFolderId)?.name : "My Folders"}
          </h2>
        </div>

        <div className="flex items-center gap-3 md:gap-4 relative">
          <div className="relative flex-1 md:flex-none flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-neutral-50 rounded-full text-sm outline-none focus:ring-1 focus:ring-black transition-all w-full md:w-64"
              />
            </div>
            <div className="relative group">
              <button className={cn(
                "p-2 rounded-full border transition-all flex items-center justify-center",
                selectedTag ? "border-black bg-neutral-50" : "border-transparent bg-neutral-50 hover:bg-neutral-100"
              )}>
                <TagIcon className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-neutral-100 rounded-2xl shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-3 py-2 text-xs font-bold uppercase text-neutral-400">Filter by color</div>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-neutral-50 transition-colors",
                    !selectedTag && "font-bold"
                  )}
                >
                  All Files
                </button>
                {ACCENT_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedTag(color.name)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-neutral-50 transition-colors",
                      selectedTag === color.name && "font-bold bg-neutral-50"
                    )}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.value }} />
                    {color.name}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setSortBy(sortBy === "date" ? "name" : "date")}
              className="p-2 rounded-full border border-transparent bg-neutral-50 hover:bg-neutral-100 transition-all flex items-center justify-center text-sm font-medium text-neutral-500"
              title={`Sort by ${sortBy === "date" ? "Name" : "Date"}`}
            >
              {sortBy === "date" ? "Date" : "Name"}
            </button>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className={cn(
                "p-2 bg-black text-white rounded-full hover:scale-110 transition-transform active:scale-95 shrink-0",
                showCreateMenu && "rotate-45 bg-neutral-200 text-black"
              )}
            >
              <Plus className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showCreateMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white border border-neutral-100 rounded-2xl shadow-xl p-2 z-50"
                >
                  {[
                    { type: "folder", label: "New Folder", icon: <Folder className="w-4 h-4" /> },
                    { type: "table", label: "New Table", icon: <TableIcon className="w-4 h-4" /> },
                    { type: "text", label: "New Document", icon: <FileText className="w-4 h-4" /> },
                  ].map((item) => (
                    <button
                      key={item.type}
                      onClick={() => {
                        setCreateModalState({ isOpen: true, type: item.type as FileType });
                        setShowCreateMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 rounded-xl text-sm transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Content */}
      <ContextMenu 
        className="flex-1 overflow-y-auto"
        items={[
          { label: "New Folder", icon: <Folder className="w-4 h-4" />, onClick: () => setCreateModalState({ isOpen: true, type: "folder" }) },
          { label: "New Table", icon: <TableIcon className="w-4 h-4" />, onClick: () => setCreateModalState({ isOpen: true, type: "table" }) },
          { label: "New Document", icon: <FileText className="w-4 h-4" />, onClick: () => setCreateModalState({ isOpen: true, type: "text" }) },
        ]}
      >
        <div className="p-8 pb-24 min-h-full">
          <PromptModal
            isOpen={createModalState.isOpen}
            title={`New ${createModalState.type === "folder" ? "Folder" : createModalState.type === "table" ? "Table" : "Document"}`}
            placeholder="Name"
            onConfirm={(name) => {
              createItem(createModalState.type!, name);
              setCreateModalState({ isOpen: false, type: null });
            }}
            onCancel={() => setCreateModalState({ isOpen: false, type: null })}
          />
          
          <PromptModal
            isOpen={renameModalState.isOpen}
            title="Rename"
            placeholder="New name"
            initialValue={renameModalState.currentName}
            onConfirm={(name) => {
              if (renameModalState.fileId) {
                renameItem(renameModalState.fileId, name);
              }
              setRenameModalState({ isOpen: false, fileId: null, currentName: "" });
            }}
            onCancel={() => setRenameModalState({ isOpen: false, fileId: null, currentName: "" })}
          />

          <ConfirmationModal
            isOpen={deleteModalState.isOpen}
            title="Delete File"
            message="Are you sure you want to delete this file? This action cannot be undone."
            onConfirm={() => {
              if (deleteModalState.fileId) {
                deleteItem(deleteModalState.fileId);
              }
              setDeleteModalState({ isOpen: false, fileId: null });
            }}
            onCancel={() => setDeleteModalState({ isOpen: false, fileId: null })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onClick={() => file.type === "folder" ? setCurrentFolderId(file.id) : setSelectedFile(file)}
                  onDelete={() => setDeleteModalState({ isOpen: true, fileId: file.id })}
                  onRename={() => setRenameModalState({ isOpen: true, fileId: file.id, currentName: file.name })}
                  onDuplicate={() => duplicateItem(file)}
                  onUpdateTags={(tags) => updateTags(file.id, tags)}
                  onShare={() => {
                    const email = prompt("Enter email to share with:");
                    if (email) shareItem(file.id, email);
                  }}
                  onExport={() => exportItem(file)}
                />
              ))}
            </AnimatePresence>
            
            {filteredFiles.length === 0 && !loading && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-neutral-400">
                <img src={ILLUSTRATIONS.girlArrangingBrickGame} alt="Empty folder" className="w-48 h-48 object-contain opacity-80 mb-4" referrerPolicy="no-referrer" />
                <p className="text-sm font-medium">This folder is empty</p>
              </div>
            )}
          </div>
        </div>
      </ContextMenu>
    </div>
  );
}

function FileCard({ file, onClick, onDelete, onRename, onDuplicate, onUpdateTags, onShare, onExport }: { file: FileItem; onClick: () => void; onDelete: () => void; onRename: () => void; onDuplicate: () => void; onUpdateTags: (tags: string[]) => void; onShare: () => void; onExport: () => void; key?: any }) {
  const [showTags, setShowTags] = useState(false);
  const controls = useDragControls();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startDrag = (e: React.PointerEvent) => {
    timeoutRef.current = setTimeout(() => {
      controls.start(e);
    }, 500);
  };

  const stopDrag = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const contextMenuItems = [
    { label: "Open", icon: <ChevronRight />, onClick },
    { label: "Rename", icon: <FileText />, onClick: onRename },
    { label: "Duplicate", icon: <FileText />, onClick: onDuplicate },
    { label: "Change Tag", icon: <TagIcon />, onClick: () => setShowTags(true) },
    { label: "Share", icon: <Users />, onClick: onShare },
    { label: "Export", icon: <FileText />, onClick: onExport },
    { label: "Delete", icon: <Plus className="rotate-45" />, onClick: onDelete, variant: "danger" as const },
  ];

  return (
    <ContextMenu items={contextMenuItems} showDotsOnMobile>
      <motion.div
        layout
        drag
        dragControls={controls}
        dragListener={false}
        onPointerDown={startDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={1}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -4 }}
        whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
        className="group bg-white border border-neutral-100 rounded-2xl p-5 flex flex-col gap-4 cursor-pointer hover:border-neutral-200 hover:shadow-sm transition-all relative"
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            file.type === "folder" ? "bg-neutral-50 text-black" : "text-white"
          )} style={{ backgroundColor: file.tags && file.tags.length > 0 ? ACCENT_COLORS.find(c => c.name === file.tags[0])?.value : (file.type === "folder" ? undefined : "#000") }}>
            {file.type === "folder" ? <Folder className="w-6 h-6" /> : file.type === "table" ? <TableIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          
          <div className="flex gap-1">
            {file.tags?.map((tag) => {
              const color = ACCENT_COLORS.find(c => c.name === tag)?.value || "#000";
              return (
                <div key={tag} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col">
          <h3 className="font-semibold truncate text-sm">{file.name}</h3>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold mt-1">
            {file.type} • {new Date(file.updatedAt).toLocaleDateString()}
          </p>
        </div>

        {showTags && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl p-4 flex flex-wrap gap-2 items-center justify-center z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => {
                  const newTags = file.tags?.includes(color.name) 
                    ? file.tags.filter(t => t !== color.name) 
                    : [...(file.tags || []), color.name];
                  onUpdateTags(newTags);
                  setShowTags(false);
                }}
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125"
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
            <button onClick={() => setShowTags(false)} className="w-full mt-2 text-[10px] font-bold uppercase text-neutral-400">Close</button>
          </motion.div>
        )}
      </motion.div>
    </ContextMenu>
  );
}
