import { UserProfile, FileItem } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useState, useEffect } from "react";
import { Users, FileText, FolderOpen, TrendingUp, Calendar, Zap } from "lucide-react";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

export default function Overview({ profile }: { profile: UserProfile }) {
  const [stats, setStats] = useState({ staffCount: 0, staffFiles: 0, ownFiles: 0, totalActivity: 0 });

  useEffect(() => {
    const usersRef = ref(db, "users");
    const filesRef = ref(db, `files/${profile.schoolId}`);
    const activityRef = ref(db, `activity/${profile.schoolId}`);

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

    const unsubscribeActivity = onValue(activityRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let count = 0;
        Object.values(data).forEach((userLogs: any) => {
          count += Object.keys(userLogs).length;
        });
        setStats(prev => ({ ...prev, totalActivity: count }));
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeFiles();
      unsubscribeActivity();
    };
  }, [profile.schoolId, profile.uid]);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="p-4 md:p-8 pb-24 max-w-7xl mx-auto">
        <div className="flex flex-col gap-1 mb-8 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Overview</h2>
          <p className="text-neutral-400 text-sm md:text-base font-medium">Real-time pulse of your school's digital workspace.</p>
        </div>

        {profile.role === "owner" ? (
          <div className="flex flex-col gap-8 md:gap-12">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 bg-black rounded-3xl p-6 md:p-10 text-white relative overflow-hidden group"
              >
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <h3 className="text-3xl md:text-5xl font-semibold mb-4 leading-tight">
                      Your school is <br/>
                      <span className="text-neutral-400">
                        {stats.staffCount <= 1 && stats.totalActivity < 10 ? "staggering." : "thriving."}
                      </span>
                    </h3>
                    <p className="text-neutral-400 max-w-md text-base md:text-lg leading-relaxed">
                      With {stats.staffCount} active staff members and {stats.totalActivity} total logged activities, your digital workspace is {stats.staffCount <= 1 && stats.totalActivity < 10 ? "just getting started." : "buzzing with productivity."}
                    </p>
                  </div>
                  <div className="mt-8 md:mt-12 flex gap-6 md:gap-8">
                    <div className="flex flex-col">
                      <span className="text-3xl md:text-4xl font-semibold">{stats.totalActivity}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1">Total Actions</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-3xl md:text-4xl font-semibold">{stats.staffFiles + stats.ownFiles}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1">Files Created</span>
                    </div>
                  </div>
                </div>
                <img 
                  src={stats.staffCount <= 1 && stats.totalActivity < 10 ? ILLUSTRATIONS.mailboxAlert : ILLUSTRATIONS.achievements} 
                  alt="Status Illustration" 
                  className="absolute right-[-10%] bottom-[-10%] w-[60%] opacity-40 group-hover:scale-110 transition-transform duration-700 pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-neutral-50 rounded-3xl p-6 md:p-10 flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="relative z-10">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-6">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-black" />
                  </div>
                  <h4 className="text-xl md:text-2xl font-semibold mb-2">Staff Directory</h4>
                  <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
                    {stats.staffCount} teachers are currently connected to your school.
                  </p>
                </div>
                <div className="relative z-10 mt-6 md:mt-8">
                  <div className="text-4xl md:text-6xl font-semibold mb-2">{stats.staffCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Active Members</div>
                </div>
                <img 
                  src={ILLUSTRATIONS.survey} 
                  alt="Survey" 
                  className="absolute right-[-20%] bottom-[-10%] w-[80%] opacity-10 group-hover:rotate-6 transition-transform duration-700 pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <StatCard title="Staff Files" value={stats.staffFiles} icon={FileText} color="sky" />
              <StatCard title="My Workspace" value={stats.ownFiles} icon={FolderOpen} color="sage" />
              <StatCard title="System Load" value="Optimal" icon={Zap} color="amber" />
              <StatCard title="Next Sync" value="Real-time" icon={Calendar} color="rose" />
            </div>

            {/* Bottom Illustration Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-neutral-50 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12 overflow-hidden relative group"
            >
              <div className="flex-1 relative z-10">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">Workspace Insights</h3>
                <p className="text-neutral-500 text-sm md:text-base leading-relaxed max-w-lg">
                  Your school's data is the foundation of a better learning environment. Track progress, manage resources, and streamline your daily administrative tasks in one central place.
                </p>
              </div>
              <div className="w-full md:w-1/3 relative z-10">
                <img 
                  src={ILLUSTRATIONS.snack} 
                  alt="Snack" 
                  className="w-full max-w-[200px] md:max-w-none mx-auto hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <StatCard title="My Files" value={stats.ownFiles} icon={FolderOpen} color="sky" />
            <StatCard title="Recent Actions" value={stats.totalActivity} icon={TrendingUp} color="sage" />
            <StatCard title="Weekly Goal" value="On Track" icon={Zap} color="amber" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: any; icon: any; color: string }) {
  const colors: Record<string, string> = {
    sky: "bg-sky-50 text-sky-600",
    sage: "bg-neutral-100 text-neutral-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-red-50 text-red-600"
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 md:p-8 rounded-2xl transition-all"
    >
      <div className="flex flex-col gap-4 md:gap-6">
        <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center", colors[color])}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">{title}</p>
          <p className="text-2xl md:text-3xl font-semibold text-black">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}
