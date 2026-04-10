import { useState, useEffect } from "react";
import { UserProfile } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, onValue } from "firebase/database";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Clock, FileText, LayoutGrid, List } from "lucide-react";
import Workspace from "./Workspace";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

export default function StaffView({ profile, onPathChange, onSelectStaff }: { profile: UserProfile; onPathChange: (path: string[]) => void, onSelectStaff?: (staffId: string | null) => void }) {
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (onSelectStaff) onSelectStaff(selectedStaff ? selectedStaff.uid : null);
  }, [selectedStaff, onSelectStaff]);

  useEffect(() => {
    const usersRef = ref(db, "users");
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const staffList = Object.values(data) as UserProfile[];
        setStaff(staffList.filter(u => u.schoolId === profile.schoolId && u.role === "staff"));
      }
    });
  }, [profile.schoolId]);

  if (selectedStaff) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-8 py-4 border-b border-neutral-50 flex items-center gap-4 bg-white z-10">
          <button 
            onClick={() => {
              setSelectedStaff(null);
              setCurrentFolderId(null);
            }}
            className="text-sm font-bold uppercase tracking-wider text-neutral-400 hover:text-black transition-colors"
          >
            Staff
          </button>
          <ChevronRight className="w-4 h-4 text-neutral-200" />
          <span className="text-sm font-bold">{selectedStaff.name}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <Workspace 
            profile={profile} 
            onPathChange={onPathChange} 
            viewingStaffId={selectedStaff.uid} 
            currentFolderId={currentFolderId}
            setCurrentFolderId={setCurrentFolderId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="px-4 md:px-8 py-4 md:py-6 border-b border-neutral-50 flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Staff Directory</h2>
        <div className="flex bg-neutral-50 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
          <AnimatePresence mode="popLayout">
            {staff.map((member) => (
              <StaffCard
                key={member.uid}
                member={member}
                viewMode={viewMode}
                onClick={() => setSelectedStaff(member)}
              />
            ))}
          </AnimatePresence>
          {staff.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-neutral-400">
              <img src={ILLUSTRATIONS.teacherHoldingBook} alt="Empty staff" className="w-48 h-48 object-contain opacity-80 mb-4" referrerPolicy="no-referrer" />
              <p className="text-sm font-medium">No staff members found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffCard({ member, viewMode, onClick }: { member: UserProfile; viewMode: "grid" | "list"; onClick: () => void; key?: any }) {
  if (viewMode === "list") {
    return (
      <motion.button
        layout
        onClick={onClick}
        className="flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-xl hover:border-neutral-200 hover:shadow-sm transition-all text-left group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center font-bold text-sm">
            {member.name?.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{member.name}</h3>
            <p className="text-xs text-neutral-400">{member.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : "Never"}
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3" />
            {member.totalLogsThisWeek || 0} logs
          </div>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      layout
      onClick={onClick}
      className="bg-white border border-neutral-100 rounded-3xl p-6 flex flex-col gap-6 text-left hover:border-neutral-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center font-bold text-xl">
          {member.name?.charAt(0)}
        </div>
        <div className="px-3 py-1 bg-neutral-50 rounded-full text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          {member.subject}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold group-hover:translate-x-1 transition-transform">{member.name}</h3>
        <p className="text-sm text-neutral-400 mt-1">Last active: {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : "Never"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="bg-neutral-50 p-3 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Weekly Logs</p>
          <p className="text-xl font-bold">{member.totalLogsThisWeek || 0}</p>
        </div>
        <div className="bg-neutral-50 p-3 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Last Log</p>
          <p className="text-sm font-bold truncate">{member.lastDataLog ? new Date(member.lastDataLog).toLocaleDateString() : "None"}</p>
        </div>
      </div>
    </motion.button>
  );
}
