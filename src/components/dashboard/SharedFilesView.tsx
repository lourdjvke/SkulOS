import { UserProfile, FileItem } from "@/src/types";
import { db } from "@/src/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useState, useEffect } from "react";
import { FileText, Folder } from "lucide-react";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

export default function SharedFilesView({ profile }: { profile: UserProfile }) {
  const [sharedFiles, setSharedFiles] = useState<FileItem[]>([]);

  useEffect(() => {
    const filesRef = ref(db, `files/${profile.schoolId}`);
    const unsubscribe = onValue(filesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fileList = Object.values(data) as FileItem[];
        setSharedFiles(fileList.filter(f => f.sharedWith && f.sharedWith.includes(profile.uid)));
      }
    });
    return () => unsubscribe();
  }, [profile.schoolId, profile.uid]);

  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6">Shared with Me</h2>
      {sharedFiles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sharedFiles.map(file => (
            <div key={file.id} className="bg-white border border-neutral-100 rounded-2xl p-5 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-neutral-50 flex items-center justify-center">
                {file.type === "folder" ? <Folder className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </div>
              <h3 className="font-semibold truncate text-sm">{file.name}</h3>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
          <img src={ILLUSTRATIONS.girlPlayingChessWithDog} alt="Empty shared files" className="w-48 h-48 object-contain opacity-80 mb-4" referrerPolicy="no-referrer" />
          <p className="text-sm font-medium">No files shared with you yet.</p>
        </div>
      )}
    </div>
  );
}
