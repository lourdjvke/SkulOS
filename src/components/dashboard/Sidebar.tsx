import { School, UserRole } from "@/src/types";
import { LayoutGrid, Users, FolderKanban, Settings, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { auth } from "@/src/lib/firebase";
import { cn } from "@/src/lib/utils";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

interface SidebarProps {
  school: School | null;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  role: UserRole;
  onClose?: () => void;
}

export default function Sidebar({ school, activeTab, setActiveTab, role, onClose }: SidebarProps) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    ...(role === "owner" ? [{ id: "staff", label: "Staff", icon: Users }] : []),
    { id: "folders", label: "My Folders", icon: FolderKanban },
    { id: "shared", label: "Shared with Me", icon: FolderKanban },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <aside className="w-full md:w-64 border-r border-neutral-100 flex flex-col h-full bg-white">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ILLUSTRATIONS.appLogo} alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
          <div className="flex flex-col overflow-hidden">
            <h1 className="font-bold truncate text-sm">{school?.name || "Loading..."}</h1>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
              {role === "owner" ? "Administrator" : "Staff Member"}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 text-neutral-400 hover:text-black">
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative",
              activeTab === item.id ? "text-black bg-neutral-50" : "text-neutral-500 hover:text-black hover:bg-neutral-50"
            )}
          >
            <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", activeTab === item.id ? "text-black" : "text-neutral-400 group-hover:text-black")} />
            {item.label}
            {activeTab === item.id && (
              <motion.div
                layoutId="active-pill"
                className="absolute left-0 w-1 h-4 bg-black rounded-full"
              />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-50">
        <button
          onClick={() => auth.signOut()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:text-red-500 hover:bg-red-50 transition-all group"
        >
          <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
