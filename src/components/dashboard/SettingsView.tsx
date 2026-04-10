import { useState, useEffect } from "react";
import { UserProfile, School } from "@/src/types";
import { db, auth } from "@/src/lib/firebase";
import { ref, update, get, remove, onValue } from "firebase/database";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, UserMinus, Copy, Check, Trash2, ShieldAlert, Link as LinkIcon, LogOut } from "lucide-react";
import Button from "@/src/components/ui/Button";
import { cn } from "@/src/lib/utils";

export default function SettingsView({ profile, school }: { profile: UserProfile; school: School | null }) {
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [resetWithWipe, setResetWithWipe] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState<string | null>(null);
  const [showConfirmSelfRemove, setShowConfirmSelfRemove] = useState(false);
  const [useCustomApi, setUseCustomApi] = useState(() => localStorage.getItem("use_custom_api") === "true");
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("custom_gemini_api_key") || "");
  const [randomizeModels, setRandomizeModels] = useState(() => localStorage.getItem("randomize_models") === "true");

  useEffect(() => {
    localStorage.setItem("use_custom_api", String(useCustomApi));
  }, [useCustomApi]);

  useEffect(() => {
    localStorage.setItem("custom_gemini_api_key", customApiKey);
  }, [customApiKey]);

  useEffect(() => {
    localStorage.setItem("randomize_models", String(randomizeModels));
  }, [randomizeModels]);

  useEffect(() => {
    if (profile.schoolId && profile.role === "owner") {
      const usersRef = ref(db, "users");
      const unsubscribe = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const staffList = Object.values(data) as UserProfile[];
          setStaff(staffList.filter(u => u.schoolId === profile.schoolId && u.role === "staff"));
        }
      });
      return () => unsubscribe();
    }
  }, [profile.schoolId, profile.role]);

  const handleCopyCode = () => {
    if (!school?.inviteCode) return;
    navigator.clipboard.writeText(school.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!school?.inviteCode) return;
    const link = `${window.location.origin}?code=${school.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetInviteCode = async () => {
    if (!profile.schoolId) return;
    setLoading(true);
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      await update(ref(db, `schools/${profile.schoolId}`), { inviteCode: newCode });
      
      if (resetWithWipe) {
        const updates: any = {};
        staff.forEach(member => {
          updates[`users/${member.uid}/schoolId`] = null;
        });
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }
      setShowConfirmReset(false);
    } catch (error) {
      console.error("Error resetting code:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeStaff = async () => {
    if (!showConfirmRemove) return;
    await update(ref(db, `users/${showConfirmRemove}`), { schoolId: null });
    setShowConfirmRemove(null);
  };

  const removeSelf = async () => {
    setLoading(true);
    try {
      await update(ref(db, `users/${profile.uid}`), { role: "retired" });
      window.location.reload();
    } catch (error) {
      console.error("Error removing self:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <header className="px-8 py-6 border-b border-neutral-50">
        <h2 className="text-2xl font-medium tracking-tight">Settings</h2>
        <p className="text-sm text-neutral-400 mt-1">Manage your account and preferences.</p>
      </header>

      <div className="p-8 pb-24 flex flex-col gap-12 max-w-4xl">
        {profile.role === "owner" ? (
          <>
            {/* Invite Section */}
            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium">Access Control</h3>
                <p className="text-sm text-neutral-500">Share this code or link with your staff to let them join your school.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-neutral-50 rounded-3xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Invite Code</span>
                    <button onClick={handleCopyCode} className="text-neutral-400 hover:text-black transition-colors">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-3xl font-mono font-medium tracking-widest">{school?.inviteCode || "------"}</div>
                </div>

                <div className="p-6 bg-neutral-50 rounded-3xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Invite Link</span>
                    <button onClick={handleCopyLink} className="text-neutral-400 hover:text-black transition-colors">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-sm font-medium text-neutral-600 truncate">
                    {window.location.origin}?code={school?.inviteCode}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Button 
                  variant="secondary" 
                  className="w-fit flex items-center gap-2 text-red-500 hover:bg-red-50 border-none bg-red-50/50"
                  onClick={() => setShowConfirmReset(true)}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Invite Code
                </Button>
                <p className="text-xs text-neutral-400 italic">Resetting the code will prevent new staff from joining with the old code.</p>
              </div>
            </section>

            {/* Staff Management */}
            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium">Manage Staff</h3>
                <p className="text-sm text-neutral-500">View and manage active staff members in your school.</p>
              </div>

              <div className="flex flex-col rounded-3xl overflow-hidden bg-neutral-50/50">
                {staff.length === 0 ? (
                  <div className="p-12 text-center text-neutral-400 text-sm">No staff members joined yet.</div>
                ) : (
                  staff.map((member, index) => (
                    <div 
                      key={member.uid} 
                      className={cn(
                        "p-4 flex items-center justify-between hover:bg-neutral-100 transition-colors",
                        index !== staff.length - 1 && "border-b border-neutral-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-medium text-sm">
                          {member.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">{member.subject}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowConfirmRemove(member.uid)}
                        className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                        title="Remove Staff"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Staff Settings */}
            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium">Account Actions</h3>
                <p className="text-sm text-neutral-500">Manage your connection to the school.</p>
              </div>

              <div className="p-6 bg-neutral-50 rounded-3xl flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium text-sm">Remove Self from School</h4>
                  <p className="text-sm text-neutral-500">
                    This will mark your account as retired. You will lose access to the school's workspace, but the owner will retain your past records. You will need a new account to join a different school.
                  </p>
                </div>
                <Button 
                  variant="secondary" 
                  className="w-fit flex items-center gap-2 text-red-500 hover:bg-red-50 border-none bg-white"
                  onClick={() => setShowConfirmSelfRemove(true)}
                >
                  <LogOut className="w-4 h-4" />
                  Remove Account
                </Button>
              </div>
            </section>
          </>
        )}
        
        {/* API Settings (For all users) */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-medium">AI Copilot Settings</h3>
            <p className="text-sm text-neutral-500">Configure how the AI Copilot works.</p>
          </div>

          <div className="p-6 bg-neutral-50 rounded-3xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h4 className="font-medium text-sm">Use Own API Key</h4>
                <p className="text-sm text-neutral-500">Use your own Gemini API key for requests.</p>
              </div>
              <div 
                className={cn(
                  "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors",
                  useCustomApi ? "bg-black" : "bg-neutral-200"
                )}
                onClick={() => setUseCustomApi(!useCustomApi)}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  useCustomApi ? "translate-x-6" : "translate-x-0"
                )} />
              </div>
            </div>

            {useCustomApi && (
              <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-medium text-sm">Randomize Models</h4>
                    <p className="text-sm text-neutral-500">Randomly choose between flash and flash-lite models.</p>
                  </div>
                  <div 
                    className={cn(
                      "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors",
                      randomizeModels ? "bg-black" : "bg-neutral-200"
                    )}
                    onClick={() => setRandomizeModels(!randomizeModels)}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white transition-transform",
                      randomizeModels ? "translate-x-6" : "translate-x-0"
                    )} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showConfirmReset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full flex flex-col gap-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>
              
              <div className="text-center flex flex-col gap-2">
                <h3 className="text-xl font-medium">Reset Invite Code?</h3>
                <p className="text-sm text-neutral-500">This will generate a new code. You can also choose to remove all current staff members.</p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl cursor-pointer" onClick={() => setResetWithWipe(!resetWithWipe)}>
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center transition-all",
                  resetWithWipe ? "bg-black" : "bg-white"
                )}>
                  {resetWithWipe && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm font-medium">Remove all current staff members</span>
              </div>

              <div className="flex gap-3 mt-2">
                <Button variant="secondary" className="flex-1 border-none bg-neutral-50" onClick={() => setShowConfirmReset(false)}>Cancel</Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600 border-none" onClick={resetInviteCode} disabled={loading}>
                  {loading ? "Resetting..." : "Confirm Reset"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Remove Staff Confirmation Modal */}
      <AnimatePresence>
        {showConfirmRemove && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full flex flex-col gap-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <UserMinus className="w-8 h-8" />
              </div>
              
              <div className="text-center flex flex-col gap-2">
                <h3 className="text-xl font-medium">Remove Staff Member?</h3>
                <p className="text-sm text-neutral-500">This will remove their access to the school data. They can join again with a valid invite code.</p>
              </div>

              <div className="flex gap-3 mt-2">
                <Button variant="secondary" className="flex-1 border-none bg-neutral-50" onClick={() => setShowConfirmRemove(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600 border-none" onClick={removeStaff}>
                  Remove Member
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Remove Self Confirmation Modal */}
      <AnimatePresence>
        {showConfirmSelfRemove && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full flex flex-col gap-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <LogOut className="w-8 h-8" />
              </div>
              
              <div className="text-center flex flex-col gap-2">
                <h3 className="text-xl font-medium">Remove Yourself?</h3>
                <p className="text-sm text-neutral-500">You will lose access to this school permanently. This action cannot be undone.</p>
              </div>

              <div className="flex gap-3 mt-2">
                <Button variant="secondary" className="flex-1 border-none bg-neutral-50" onClick={() => setShowConfirmSelfRemove(false)}>Cancel</Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600 border-none" onClick={removeSelf} disabled={loading}>
                  {loading ? "Removing..." : "Remove Me"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
