import React from "react";
import { motion } from "motion/react";
import { auth, db } from "@/src/lib/firebase";
import { ref, update } from "firebase/database";
import { signOut } from "firebase/auth";
import { UserRole } from "@/src/types";

export default function RoleSelection() {
  const handleSelect = async (role: UserRole) => {
    if (!auth.currentUser) return;
    await update(ref(db, `users/${auth.currentUser.uid}`), { role });
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="min-h-full flex flex-col items-center justify-center p-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl font-bold mb-2">Choose your role</h2>
          <p className="text-neutral-500">How will you be using School Data OS?</p>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl">
          <RoleCard
            title="I'm a School Owner"
            description="Principal, proprietor, or administrator"
            icon={<OwnerIcon />}
            onClick={() => handleSelect("owner")}
          />
          <RoleCard
            title="I'm a Staff Member"
            description="Teacher or school staff"
            icon={<StaffIcon />}
            onClick={() => handleSelect("staff")}
          />
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={handleSignOut}
          className="mt-12 text-sm text-neutral-400 hover:text-black transition-colors"
        >
          Sign out of account
        </motion.button>
      </div>
    </div>
  );
}

function RoleCard({ title, description, icon, onClick }: { title: string; description: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="flex-1 bg-white border border-neutral-100 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center gap-4 md:gap-6 transition-colors hover:border-neutral-200"
    >
      <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-neutral-500 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.button>
  );
}

function OwnerIcon() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full text-black stroke-current fill-none" strokeWidth="1.5">
      <rect x="20" y="30" width="60" height="50" rx="4" />
      <path d="M40 30V20a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v10" />
      <circle cx="50" cy="55" r="8" />
      <path d="M35 80h30" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full text-black stroke-current fill-none" strokeWidth="1.5">
      <circle cx="50" cy="35" r="15" />
      <path d="M25 80c0-15 10-25 25-25s25 10 25 25" />
      <path d="M40 55l-5 5M60 55l5 5" />
    </svg>
  );
}
