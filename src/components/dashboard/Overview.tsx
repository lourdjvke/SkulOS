import { UserProfile, FileItem } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useState, useEffect } from "react";
import { Users, FileText, FolderOpen } from "lucide-react";

export default function Overview({ profile }: { profile: UserProfile }) {
  const [stats, setStats] = useState({ staffCount: 0, staffFiles: 0, ownFiles: 0 });

  useEffect(() => {
    const usersRef = ref(db, "users");
    const filesRef = ref(db, `files/${profile.schoolId}`);

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const staffList = Object.values(data) as UserProfile[];
        setStats(prev => ({ ...prev, staffCount: staffList.filter(u => u.schoolId === profile.schoolId && u.role === "staff").length }));
      }
    });

    const unsubscribeFiles = onValue(filesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const filesList = Object.values(data) as FileItem[];
        setStats(prev => ({ 
          ...prev, 
          staffFiles: filesList.filter(f => f.ownerId !== profile.uid).length,
          ownFiles: filesList.filter(f => f.ownerId === profile.uid).length
        }));
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeFiles();
    };
  }, [profile.schoolId, profile.uid]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {profile.role === "owner" ? (
          <>
            <StatCard title="Staff Members" value={stats.staffCount} icon={Users} />
            <StatCard title="Staff Files" value={stats.staffFiles} icon={FileText} />
            <StatCard title="My Files" value={stats.ownFiles} icon={FolderOpen} />
          </>
        ) : (
          <StatCard title="My Files" value={stats.ownFiles} icon={FolderOpen} />
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: any }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-neutral-50 rounded-xl">
          <Icon className="w-6 h-6 text-neutral-600" />
        </div>
        <div>
          <p className="text-sm text-neutral-400 font-medium">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
