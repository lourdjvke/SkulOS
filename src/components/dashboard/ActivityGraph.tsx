import { useState, useEffect } from "react";
import { db } from "@/src/lib/firebase";
import { ref, onValue } from "firebase/database";
import { ActivityLog } from "@/src/types";
import { cn } from "@/src/lib/utils";
import { ChevronDown, ChevronUp, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ActivityGraphProps {
  userId: string;
  schoolId: string;
  defaultFolded?: boolean;
  title?: string;
}

export default function ActivityGraph({ userId, schoolId, defaultFolded = false, title = "Activity" }: ActivityGraphProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isFolded, setIsFolded] = useState(defaultFolded);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activityRef = ref(db, `activity/${schoolId}/${userId}`);
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLogs(Object.values(data) as ActivityLog[]);
      } else {
        setLogs([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId, schoolId]);

  // Generate last 84 days (12 weeks)
  const days = Array.from({ length: 84 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - i));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const activityByDay = logs.reduce((acc, log) => {
    const date = new Date(log.timestamp);
    date.setHours(0, 0, 0, 0);
    const key = date.getTime();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  if (loading) return <div className="h-20 animate-pulse bg-neutral-50 rounded-3xl" />;

  return (
    <div className="flex flex-col gap-4">
      <button 
        onClick={() => setIsFolded(!isFolded)}
        className="flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-400 group-hover:text-black transition-colors" />
          <h3 className="text-sm font-bold text-neutral-500 group-hover:text-black transition-colors">{title}</h3>
          <span className="text-[10px] font-bold bg-neutral-100 text-neutral-400 px-1.5 py-0.5 rounded-full">
            {logs.length} events
          </span>
        </div>
        {isFolded ? <ChevronDown className="w-4 h-4 text-neutral-300" /> : <ChevronUp className="w-4 h-4 text-neutral-300" />}
      </button>

      <AnimatePresence>
        {!isFolded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-neutral-50 rounded-3xl">
              <div className="flex flex-wrap gap-1.5">
                {days.map((day) => {
                  const count = activityByDay[day.getTime()] || 0;
                  return (
                    <div
                      key={day.getTime()}
                      title={`${day.toDateString()}: ${count} activities`}
                      className={cn(
                        "w-3 h-3 rounded-full transition-all hover:scale-125 cursor-pointer",
                        count > 0 ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]" : "bg-neutral-200"
                      )}
                    />
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                <span>Last 12 Weeks</span>
                <div className="flex items-center gap-2">
                  <span>Less</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-neutral-200" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <span>More</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
