import { useState, useEffect } from "react";
import { UserProfile, School } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, onValue } from "firebase/database";
import Sidebar from "./Sidebar";
import StaffView from "./StaffView";
import Workspace from "./Workspace";
import AICopilot from "./AICopilot";
import SettingsView from "./SettingsView";
import Overview from "./Overview";
import SharedFilesView from "./SharedFilesView";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Menu, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

export default function Dashboard({ profile }: { profile: UserProfile }) {
  const [school, setSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "staff" | "folders" | "shared" | "settings">("overview");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentFolderId(null);
    setCurrentPath([]);
    setSelectedStaffId(null);
  }, [activeTab]);

  useEffect(() => {
    if (profile.schoolId) {
      const schoolRef = ref(db, `schools/${profile.schoolId}`);
      onValue(schoolRef, (snapshot) => {
        setSchool(snapshot.val());
      });
    }
  }, [profile.schoolId]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showCopilot = isCopilotOpen || (activeTab === "folders" && isDesktop);

  return (
    <div className="h-full flex bg-white relative overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar 
          school={school} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={profile.role} 
          isCopilotOpen={showCopilot}
          onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white z-[70] md:hidden shadow-2xl"
            >
              <Sidebar 
                school={school} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                role={profile.role} 
                onClose={() => setIsSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-neutral-50 bg-white z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-neutral-500">
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-bold text-sm truncate max-w-[200px]">{school?.name}</div>
          <button onClick={() => setIsCopilotOpen(true)} className="p-2 -mr-2 text-neutral-500">
            <MessageSquare className="w-6 h-6" />
          </button>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "overview" ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full"
            >
              {profile.role === "owner" ? <Overview profile={profile} /> : <Workspace profile={profile} onPathChange={setCurrentPath} currentFolderId={currentFolderId} setCurrentFolderId={setCurrentFolderId} />}
            </motion.div>
          ) : activeTab === "staff" && profile.role === "owner" ? (
            <motion.div
              key="staff"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full"
            >
              <StaffView 
                profile={profile} 
                onPathChange={setCurrentPath} 
                onSelectStaff={setSelectedStaffId}
                currentFolderId={currentFolderId}
                setCurrentFolderId={setCurrentFolderId}
              />
            </motion.div>
          ) : activeTab === "folders" ? (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full"
            >
              <Workspace 
                profile={profile} 
                onPathChange={setCurrentPath} 
                currentFolderId={currentFolderId}
                setCurrentFolderId={setCurrentFolderId}
              />
            </motion.div>
          ) : activeTab === "shared" ? (
            <motion.div
              key="shared"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full"
            >
              <SharedFilesView profile={profile} />
            </motion.div>
          ) : activeTab === "settings" ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full"
            >
              <SettingsView profile={profile} school={school} />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex items-center justify-center text-neutral-400 p-8"
            >
              <div className="text-center flex flex-col items-center gap-4">
                <img src={ILLUSTRATIONS.girlPastingFlyers} alt="Empty state" className="w-48 h-48 object-contain opacity-80" referrerPolicy="no-referrer" />
                <p className="text-sm font-medium">Select a section to get started</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Copilot Toggle (Floating Button) */}
        {!showCopilot && (
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-xl flex items-center justify-center z-50 hover:scale-110 active:scale-95 transition-transform"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        )}
      </main>

      {/* Copilot Sidebar (Desktop) & Overlay (Mobile) */}
      <AnimatePresence>
        {showCopilot && (
          <>
            {/* Mobile Overlay Background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCopilotOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[80] md:hidden"
            />
            
            <motion.aside
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "fixed inset-y-0 right-0 w-full sm:w-[400px] md:relative md:w-[380px] md:translate-x-0 z-[90] md:z-auto",
                "bg-white border-l border-neutral-100 shadow-2xl md:shadow-none overflow-hidden flex flex-col"
              )}
            >
              <div className="md:hidden absolute top-4 right-4 z-[100]">
                <button onClick={() => setIsCopilotOpen(false)} className="p-2 bg-neutral-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <AICopilot 
                profile={profile} 
                currentPath={currentPath} 
                currentFolderId={currentFolderId}
                selectedStaffId={selectedStaffId}
                onNavigate={(id) => {
                  setActiveTab("folders");
                  setCurrentFolderId(id);
                  if (window.innerWidth < 768) setIsCopilotOpen(false);
                }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
