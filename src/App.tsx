import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { ref, onValue, get, update } from "firebase/database";
import { auth, db } from "@/src/lib/firebase";
import { UserProfile, UserRole } from "@/src/types";
import AuthScreen from "@/src/components/auth/AuthScreen";
import RoleSelection from "@/src/components/auth/RoleSelection";
import Onboarding from "@/src/components/auth/Onboarding";
import Dashboard from "@/src/components/dashboard/Dashboard";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("code");
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch profile
        const profileRef = ref(db, `users/${firebaseUser.uid}`);
        onValue(profileRef, async (snapshot) => {
          const profileData = snapshot.val() as UserProfile;
          setProfile(profileData);
          
          // If we have an invite code and user doesn't have a school yet
          // Onboarding component will read the URL param on mount
          
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 border-4 border-black border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-black">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <AuthScreen />
          </motion.div>
        ) : !profile?.role ? (
          <motion.div
            key="role"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full"
          >
            <RoleSelection />
          </motion.div>
        ) : profile.role === "retired" ? (
          <motion.div
            key="retired"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="max-w-md flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center">
                <span className="text-3xl">👋</span>
              </div>
              <h1 className="text-2xl font-medium">Account Retired</h1>
              <p className="text-neutral-500">
                You have been removed from the school workspace. Your past records are retained by the school owner, but you no longer have access to this account.
              </p>
              <button 
                onClick={() => auth.signOut()}
                className="px-6 py-3 bg-black text-white rounded-full font-medium hover:scale-105 transition-transform"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        ) : profile.role === "owner" && !profile.schoolId ? (
          <motion.div
            key="onboarding-owner"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full"
          >
            <Onboarding role="owner" />
          </motion.div>
        ) : profile.role === "staff" && !profile.schoolId ? (
          <motion.div
            key="onboarding-staff"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full"
          >
            <Onboarding role="staff" />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full"
          >
            <Dashboard profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
