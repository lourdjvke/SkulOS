import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "@/src/lib/firebase";
import { ref, set, update, push, get } from "firebase/database";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

export default function Onboarding({ role }: { role: "owner" | "staff" }) {
  if (role === "owner") return <OwnerOnboarding />;
  return <StaffOnboarding />;
}

function OwnerOnboarding() {
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    const schoolRef = push(ref(db, "schools"));
    const schoolId = schoolRef.key!;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const schoolData = {
      id: schoolId,
      name: schoolName,
      address,
      type: schoolType,
      ownerId: auth.currentUser.uid,
      inviteCode,
      createdAt: Date.now()
    };

    await set(schoolRef, schoolData);
    await update(ref(db, `users/${auth.currentUser.uid}`), {
      schoolId,
      name: ownerName || "Principal"
    });
    setLoading(false);
  };

  const handleBackToRole = async () => {
    if (!auth.currentUser) return;
    await update(ref(db, `users/${auth.currentUser.uid}`), { role: null });
  };

  const steps = [
    {
      title: "What's your name?",
      illustration: ILLUSTRATIONS.womanCarryingBooks,
      content: (
        <Input
          placeholder="Full Name"
          value={ownerName}
          onChange={(e: any) => setOwnerName(e.target.value)}
          className="text-lg py-4"
          autoFocus
        />
      )
    },
    {
      title: "School Name",
      illustration: ILLUSTRATIONS.teacherHoldingBook,
      content: (
        <Input
          placeholder="Enter school name"
          value={schoolName}
          onChange={(e: any) => setSchoolName(e.target.value)}
          className="text-lg py-4"
          autoFocus
        />
      )
    },
    {
      title: "Location",
      illustration: ILLUSTRATIONS.girlRidingBikeWithBaguette,
      content: (
        <Input
          placeholder="School address"
          value={address}
          onChange={(e: any) => setAddress(e.target.value)}
          className="text-lg py-4"
          autoFocus
        />
      )
    },
    {
      title: "School Type",
      illustration: ILLUSTRATIONS.girlArrangingBrickGame,
      content: (
        <div className="flex flex-col gap-3">
          {["Primary", "Secondary", "Tertiary"].map((type) => (
            <button
              key={type}
              onClick={() => setSchoolType(type)}
              className={`p-4 rounded-xl border text-left transition-all ${
                schoolType === type ? "border-black bg-neutral-50" : "border-neutral-100 hover:border-neutral-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="min-h-full flex items-center justify-center p-6 py-12">
        <div className="w-full max-w-md flex flex-col gap-12">
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              className={`p-2 rounded-full hover:bg-neutral-100 transition-colors ${step === 1 ? "opacity-0 pointer-events-none" : ""}`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-all ${s === step ? "w-6 bg-black" : "bg-neutral-200"}`}
                />
              ))}
            </div>
            <div className="w-10" />
          </div>

          <div className="flex flex-col gap-8 min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex flex-col gap-6"
              >
                {steps[step - 1].illustration && (
                  <img src={steps[step - 1].illustration} alt="Illustration" className="w-40 h-40 object-contain mx-auto mb-4" referrerPolicy="no-referrer" />
                )}
                <h2 className="text-3xl font-bold tracking-tight text-center">{steps[step - 1].title}</h2>
                {steps[step - 1].content}
              </motion.div>
            </AnimatePresence>
          </div>

          <Button
            onClick={() => step < 4 ? setStep(step + 1) : handleComplete()}
            disabled={loading || (step === 1 && !ownerName) || (step === 2 && !schoolName) || (step === 3 && !address) || (step === 4 && !schoolType)}
            className="py-4 text-lg flex items-center justify-center gap-2"
          >
            {loading ? "Creating School..." : step === 4 ? "Complete Setup" : "Next Step"}
            {step < 4 && <ChevronRight className="w-5 h-5" />}
          </Button>

          <button
            onClick={handleBackToRole}
            className="text-sm text-neutral-400 hover:text-black transition-colors"
          >
            Change role
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffOnboarding() {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("code")?.toUpperCase() || "";
  });
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const verifyCode = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError("");

    try {
      const schoolsRef = ref(db, "schools");
      const snapshot = await get(schoolsRef);
      let foundSchoolId = null;
      
      if (snapshot.exists()) {
        const schools = snapshot.val();
        for (const id in schools) {
          if (schools[id].inviteCode === code.toUpperCase()) {
            foundSchoolId = id;
            break;
          }
        }
      }

      if (foundSchoolId) {
        setSchoolId(foundSchoolId);
        setStep(2);
      } else {
        setError("Invalid invite code. Please check with your school owner.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!auth.currentUser || !schoolId) return;
    setLoading(true);
    try {
      await update(ref(db, `users/${auth.currentUser.uid}`), {
        schoolId,
        name,
        subject: subject || "General"
      });
    } catch (err) {
      setError("Failed to complete setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToRole = async () => {
    if (!auth.currentUser) return;
    await update(ref(db, `users/${auth.currentUser.uid}`), { role: null });
  };

  const steps = [
    {
      title: "Enter invite code",
      description: "Your school owner will provide this code to you.",
      illustration: ILLUSTRATIONS.girlPlayingChessWithDog,
      content: (
        <div className="relative">
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="••••••"
            className="w-full text-center text-6xl font-mono tracking-[0.5em] py-8 bg-transparent border-b-2 border-neutral-100 outline-none focus:border-black transition-all uppercase placeholder:text-neutral-100"
            autoFocus
          />
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, x: [0, -10, 10, -10, 10, 0] }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -bottom-10 left-0 right-0 text-red-500 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    },
    {
      title: "What's your name?",
      description: "This is how you'll appear to your colleagues.",
      illustration: ILLUSTRATIONS.womanCarryingBooks,
      content: (
        <Input
          placeholder="Full Name"
          value={name}
          onChange={(e: any) => setName(e.target.value)}
          className="text-2xl py-6 text-center font-bold"
          autoFocus
        />
      )
    },
    {
      title: "What do you teach?",
      description: "Your primary subject or department.",
      illustration: ILLUSTRATIONS.teacherHoldingBook,
      content: (
        <Input
          placeholder="e.g. Mathematics, English, Admin"
          value={subject}
          onChange={(e: any) => setSubject(e.target.value)}
          className="text-2xl py-6 text-center font-bold"
          autoFocus
        />
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="min-h-full flex items-center justify-center p-6 py-12">
        <div className="w-full max-w-md flex flex-col gap-12 text-center">
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              className={`p-2 rounded-full hover:bg-neutral-100 transition-colors ${step === 1 ? "opacity-0 pointer-events-none" : ""}`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-all ${s === step ? "w-6 bg-black" : "bg-neutral-200"}`}
                />
              ))}
            </div>
            <div className="w-10" />
          </div>

          <div className="flex flex-col gap-8 min-h-[250px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex flex-col gap-4"
              >
                {steps[step - 1].illustration && (
                  <img src={steps[step - 1].illustration} alt="Illustration" className="w-40 h-40 object-contain mx-auto mb-4" referrerPolicy="no-referrer" />
                )}
                <h2 className="text-4xl font-bold tracking-tight">{steps[step - 1].title}</h2>
                <p className="text-neutral-500">{steps[step - 1].description}</p>
                <div className="mt-4">
                  {steps[step - 1].content}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-4">
            <Button
              onClick={() => {
                if (step === 1) verifyCode();
                else if (step === 2) setStep(3);
                else handleComplete();
              }}
              disabled={loading || (step === 1 && code.length < 6) || (step === 2 && !name) || (step === 3 && !subject)}
              className="py-4 text-lg flex items-center justify-center gap-2"
            >
              {loading ? "Processing..." : step === 3 ? "Join School" : "Continue"}
              {step < 3 && <ChevronRight className="w-5 h-5" />}
            </Button>

            <button
              type="button"
              onClick={handleBackToRole}
              className="text-sm text-neutral-400 hover:text-black transition-colors"
            >
              Change role
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
