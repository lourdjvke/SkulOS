import { useState, useRef, useEffect, useMemo } from "react";
import { UserProfile, FileItem, FileType } from "@/src/types";
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { db } from "@/src/lib/firebase";
import { ref, push, set, get, update } from "firebase/database";
import { motion, AnimatePresence } from "motion/react";
import { Send, BrainCircuit, User, Bot, Loader2, Square, Mic, Check, X, MicOff, Key, ExternalLink } from "lucide-react";
import { cn } from "@/src/lib/utils";
import Markdown from "react-markdown";
import { ILLUSTRATIONS } from "@/src/lib/illustrations";

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "builder" | "table" | "editProposal" | "toolConfirmation" | "backgroundTask";
  data?: any;
  targetId?: string;
}

export default function AICopilot({ 
  profile, 
  currentPath, 
  currentFolderId, 
  selectedStaffId, 
  onNavigate,
  onOpenSettings
}: { 
  profile: UserProfile; 
  currentPath: string[]; 
  currentFolderId: string | null; 
  selectedStaffId?: string | null; 
  onNavigate?: (folderId: string) => void;
  onOpenSettings?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your School Data Copilot. I can help you build structures or query your school's data. What can I do for you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Live API State
  const [isLive, setIsLive] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const useCustomApi = localStorage.getItem("use_custom_api") === "true";
  const customApiKey = localStorage.getItem("custom_gemini_api_key") || "";
  const randomizeModels = localStorage.getItem("randomize_models") === "true";

  const apiKey = useCustomApi && customApiKey ? customApiKey : process.env.GEMINI_API_KEY;
  
  const ai = useMemo(() => {
    if (!apiKey) return null;
    try {
      return new GoogleGenAI({ apiKey } as any);
    } catch (e) {
      console.error("AI Init Error:", e);
      return null;
    }
  }, [apiKey]);

  const hasApiKey = !!ai;

  const models = ["gemini-2.5-flash", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  
  // Use the requested models, randomizing if enabled
  const modelToUse = randomizeModels 
    ? models[Math.floor(Math.random() * models.length)] 
    : models[0]; // Default to the first model in the list

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading && queue.length > 0) {
      const nextMessage = queue[0];
      setQueue(prev => prev.slice(1));
      processMessage(nextMessage);
    }
  }, [isLoading, queue]);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    setIsLive(false);
    setIsLiveConnecting(false);
  };

  const startLiveSession = async () => {
    if (!ai) return;
    setIsLiveConnecting(true);
    try {
      // Fetch context
      const filesRef = ref(db, `files/${profile.schoolId}`);
      const usersRef = ref(db, `users`);
      const activityRef = ref(db, `activity/${profile.schoolId}`);
      const [filesSnapshot, usersSnapshot, activitySnapshot] = await Promise.all([
        get(filesRef), 
        get(usersRef),
        get(activityRef)
      ]);
      
      const allFiles = filesSnapshot.exists() ? Object.values(filesSnapshot.val()) as FileItem[] : [];
      const allUsers = usersSnapshot.exists() ? Object.values(usersSnapshot.val()) as UserProfile[] : [];
      const allActivity = activitySnapshot.exists() ? activitySnapshot.val() : {};
      
      const isOwner = profile.role === 'owner';
      
      const context = {
        schoolName: "The School",
        userRole: profile.role,
        currentPath: currentPath.join(" > "),
        selectedStaffId: selectedStaffId,
        availableFiles: (isOwner ? allFiles : allFiles.filter(f => f.ownerId === profile.uid)).map(f => ({ 
          id: f.id,
          name: f.name, 
          type: f.type, 
          path: f.parentId || "root",
          content: f.content,
          ownerId: f.ownerId,
          versionsCount: f.versions?.length || 0
        })),
        allStaff: isOwner ? allUsers.filter(u => u.schoolId === profile.schoolId && u.role === "staff").map(u => ({
          name: u.name,
          uid: u.uid,
          subject: u.subject,
          lastDataLog: u.lastDataLog,
          totalLogsThisWeek: u.totalLogsThisWeek,
          recentActivity: allActivity[u.uid] ? Object.values(allActivity[u.uid]).slice(-10) : []
        })) : []
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const playbackContext = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = playbackContext;
      nextPlayTimeRef.current = playbackContext.currentTime;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsLive(true);
            setIsLiveConnecting(false);
            setMessages(prev => [...prev, { role: "assistant", content: "Live audio session started. I'm listening..." }]);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && playbackContextRef.current) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = playbackContextRef.current.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 0x7FFF;
              }
              
              const playSource = playbackContextRef.current.createBufferSource();
              playSource.buffer = audioBuffer;
              playSource.connect(playbackContextRef.current.destination);
              
              const playTime = Math.max(playbackContextRef.current.currentTime, nextPlayTimeRef.current);
              playSource.start(playTime);
              nextPlayTimeRef.current = playTime + audioBuffer.duration;
            }

            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = playbackContextRef.current?.currentTime || 0;
            }
          },
          onclose: () => {
            stopLiveSession();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are a helpful School Data Copilot. You are in an exploration-only voice chat mode. 
Keep your answers concise and conversational. DO NOT call any functions or tools. 
If the user asks you to perform an action (like creating a file, moving, tagging, editing), tell them to use the text chat to perform that action.
Context: ${JSON.stringify(context)}`,
        },
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start live session:", err);
      setIsLiveConnecting(false);
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to start live audio session. Please check microphone permissions." }]);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    
    if (isLoading) {
      setQueue(prev => [...prev, userMessage]);
      setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    } else {
      setMessages(prev => [...prev, { role: "user", content: userMessage }]);
      processMessage(userMessage);
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setMessages(prev => [...prev, { role: "assistant", content: "_Generation stopped._" }]);
    }
  };

  const processMessage = async (userMessage: string) => {
    if (!ai) return;
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      // 1. Fetch relevant data context
      const filesRef = ref(db, `files/${profile.schoolId}`);
      const usersRef = ref(db, `users`);
      const activityRef = ref(db, `activity/${profile.schoolId}`);
      const [filesSnapshot, usersSnapshot, activitySnapshot] = await Promise.all([
        get(filesRef), 
        get(usersRef),
        get(activityRef)
      ]);
      
      const allFiles = filesSnapshot.exists() ? Object.values(filesSnapshot.val()) as FileItem[] : [];
      const allUsers = usersSnapshot.exists() ? Object.values(usersSnapshot.val()) as UserProfile[] : [];
      const allActivity = activitySnapshot.exists() ? activitySnapshot.val() : {};
      
      const isOwner = profile.role === 'owner';
      
      const context = {
        schoolName: "The School",
        userRole: profile.role,
        currentPath: currentPath.join(" > "),
        selectedStaffId: selectedStaffId,
        availableFiles: (isOwner ? allFiles : allFiles.filter(f => f.ownerId === profile.uid)).map(f => ({ 
          id: f.id,
          name: f.name, 
          type: f.type, 
          path: f.parentId || "root",
          content: f.content,
          ownerId: f.ownerId,
          versionsCount: f.versions?.length || 0
        })),
        allStaff: isOwner ? allUsers.filter(u => u.schoolId === profile.schoolId && u.role === "staff").map(u => ({
          name: u.name,
          uid: u.uid,
          subject: u.subject,
          lastDataLog: u.lastDataLog,
          totalLogsThisWeek: u.totalLogsThisWeek,
          recentActivity: allActivity[u.uid] ? Object.values(allActivity[u.uid]).slice(-10) : []
        })) : []
      };

      // 2. Call Gemini with retry logic
      let response;
      const modelsToTry = randomizeModels ? [...models].sort(() => Math.random() - 0.5) : [...models];
      let success = false;
      
      for (let i = 0; i < Math.min(modelsToTry.length, 3); i++) {
        try {
          response = await (ai as any).models.generateContent({
            model: modelsToTry[i],
        contents: [
          {
            role: "user",
            parts: [{ text: `
              Context: ${JSON.stringify(context)}
              User Request: ${userMessage}
              
              You are a School Data Copilot. You can:
              1. Answer questions about the school data.
              2. Build structures (folders, tables, files).
              3. Add color tags to files.
              4. Move files.
              5. Edit text files.
              
              If the user asks about a specific teacher, use the \`allStaff\` data in the context to provide information.
              If a \`selectedStaffId\` is provided, focus your answers on that teacher's folders and files (by filtering \`availableFiles\` by \`ownerId === selectedStaffId\`).
              
              If the user wants to build something, return a JSON object in your response like this:
              { "action": "build", "items": [{ "type": "folder" | "table" | "text", "name": "Name", "parentId": "current" | "root" | "id_of_parent", "id": "temp_id_for_nesting", "columns": ["Col1", "Col2"], "rows": [{ "Col1": "Value1", "Col2": "Value2" }], "content": "Text content for text files" }] }
              
              If the user wants to add a color tag to files, return:
              { "action": "addTag", "fileIds": ["id1", "id2"], "tag": "red" }
              
              If the user wants to move a file, return:
              { "action": "moveFile", "fileId": "id", "newParentId": "new_parent_id" }
              
              If the user wants to edit a text file, return:
              { "action": "proposeEdit", "fileId": "id", "newContent": "The new content of the file" }
              
              If the user asks to create a table from data in a file, look for the data in the provided context, extract it, and include it in the "rows" array.
              
              For example, to create a folder and a table inside it with pre-filled data:
              { "action": "build", "items": [{ "type": "folder", "name": "My Folder", "id": "f1", "parentId": "current" }, { "type": "table", "name": "My Table", "parentId": "f1", "columns": ["Name", "Score"], "rows": [{ "Name": "John", "Score": "90" }] }] }

              Otherwise, just respond with helpful text. Use Markdown for formatting (bold, italics, lists, etc.).
              Keep responses clean, professional, and concise.
            ` }]
          }
        ],
        config: {
          temperature: 0.7,
        }
      });
      success = true;
      break;
    } catch (e) {
      console.error(`Attempt ${i + 1} failed:`, e);
    }
  }

  if (!success) throw new Error("Copilot is having issues currently... Please try again later");

  const aiResponse = response.text || "I'm sorry, I couldn't process that.";
      
      // 3. Handle actions if any
      try {
        const actionMatch = aiResponse.match(/\{.*\}/s);
        if (actionMatch) {
          const actionData = JSON.parse(actionMatch[0]);
          if (actionData.action === "build") {
            const idMap: Record<string, string> = {};
            let lastCreatedId = null;
            for (const item of actionData.items) {
              let pId = currentFolderId;
              if (item.parentId === "root") {
                pId = null;
              } else if (item.parentId && item.parentId !== "current") {
                pId = idMap[item.parentId] || item.parentId;
              }
              const newId = await createItem(item.type, item.name, pId, item.columns, item.rows, item.content);
              if (item.id) {
                idMap[item.id] = newId;
              }
              lastCreatedId = newId;
            }
            setMessages(prev => [...prev, { 
              role: "assistant", 
              content: "I've built the requested structure for you!",
              type: "builder",
              data: actionData.items,
              targetId: lastCreatedId || undefined
            }]);
          } else if (actionData.action === "addTag") {
            for (const fileId of actionData.fileIds) {
              const fileRef = ref(db, `files/${profile.schoolId}/${fileId}`);
              const snap = await get(fileRef);
              if (snap.exists()) {
                const file = snap.val();
                const tags = file.tags || [];
                if (!tags.includes(actionData.tag)) {
                  await update(fileRef, { tags: [...tags, actionData.tag] });
                  
                  // Log activity
                  const activityRef = ref(db, `activity/${profile.schoolId}/${profile.uid}`);
                  const newActivityRef = push(activityRef);
                  await set(newActivityRef, {
                    id: newActivityRef.key!,
                    userId: profile.uid,
                    userName: profile.name || "Anonymous",
                    action: "tag",
                    targetName: `${file.name} with ${actionData.tag}`,
                    targetType: file.type,
                    timestamp: Date.now()
                  });
                }
              }
            }
            setMessages(prev => [...prev, { role: "assistant", content: `I've added the tag '${actionData.tag}' to the requested files.` }]);
          } else if (actionData.action === "moveFile") {
            const fileRef = ref(db, `files/${profile.schoolId}/${actionData.fileId}`);
            const snap = await get(fileRef);
            await update(fileRef, { parentId: actionData.newParentId === "root" ? null : actionData.newParentId });
            
            if (snap.exists()) {
              const file = snap.val();
              // Log activity
              const activityRef = ref(db, `activity/${profile.schoolId}/${profile.uid}`);
              const newActivityRef = push(activityRef);
              await set(newActivityRef, {
                id: newActivityRef.key!,
                userId: profile.uid,
                userName: profile.name || "Anonymous",
                action: "move",
                targetName: file.name,
                targetType: file.type,
                timestamp: Date.now()
              });
            }
            
            setMessages(prev => [...prev, { role: "assistant", content: `I've moved the file.` }]);
          } else if (actionData.action === "proposeEdit") {
            const fileRef = ref(db, `files/${profile.schoolId}/${actionData.fileId}`);
            const snap = await get(fileRef);
            if (snap.exists()) {
              const file = snap.val();
              setMessages(prev => [...prev, { 
                role: "assistant", 
                content: `I've prepared an edit for **${file.name}**. Please review the changes below.`,
                type: "editProposal",
                data: {
                  fileId: actionData.fileId,
                  oldContent: file.content,
                  newContent: actionData.newContent
                }
              }]);
            } else {
               setMessages(prev => [...prev, { role: "assistant", content: `I couldn't find the file to edit.` }]);
            }
          } else {
            setMessages(prev => [...prev, { role: "assistant", content: aiResponse.replace(/\{.*\}/s, "").trim() }]);
          }
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
        }
      } catch (e) {
        setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
      }

    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const createItem = async (type: FileType, name: string, parentId: string | null, columns?: string[], rows?: any[], content?: string) => {
    const filesRef = ref(db, `files/${profile.schoolId}`);
    const newFileRef = push(filesRef);
    const id = newFileRef.key!;
    
    const newFile: FileItem = {
      id,
      name,
      type,
      parentId, 
      ownerId: selectedStaffId || profile.uid,
      schoolId: profile.schoolId!,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content: type === "table" ? { 
        columns: (columns || ["Name"]).map((n, i) => ({ id: "c" + i, name: n })), 
        rows: (rows || []).map((r, i) => ({
          id: Math.random().toString(36).substring(7),
          ...Object.fromEntries(
            (columns || ["Name"]).map((colName, colIdx) => ["c" + colIdx, r[colName] || ""])
          )
        }))
      } : (content || "")
    };

    await set(newFileRef, newFile);

    // Log activity
    const activityRef = ref(db, `activity/${profile.schoolId}/${profile.uid}`);
    const newActivityRef = push(activityRef);
    await set(newActivityRef, {
      id: newActivityRef.key!,
      userId: profile.uid,
      userName: profile.name || "Anonymous",
      action: "create",
      targetName: name,
      targetType: type,
      timestamp: Date.now()
    });

    // Update user's last log
    await update(ref(db, `users/${profile.uid}`), {
      lastDataLog: Date.now(),
      totalLogsThisWeek: (profile.totalLogsThisWeek || 0) + 1
    });

    return id;
  };

  const applyEdit = async (fileId: string, newContent: string) => {
    const fileRef = ref(db, `files/${profile.schoolId}/${fileId}`);
    const snap = await get(fileRef);
    await update(fileRef, { content: newContent, updatedAt: Date.now() });
    
    if (snap.exists()) {
      const file = snap.val();
      // Log activity
      const activityRef = ref(db, `activity/${profile.schoolId}/${profile.uid}`);
      const newActivityRef = push(activityRef);
      await set(newActivityRef, {
        id: newActivityRef.key!,
        userId: profile.uid,
        userName: profile.name || "Anonymous",
        action: "edit",
        targetName: file.name,
        targetType: file.type,
        timestamp: Date.now()
      });
    }
    
    setMessages(prev => [...prev, { role: "assistant", content: "Edit applied successfully!" }]);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b border-neutral-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">AI Copilot</h2>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider" style={{ color: useCustomApi && customApiKey ? '#22c55e' : undefined }}>Context Aware</p>
          </div>
        </div>
        {queue.length > 0 && (
          <div className="px-2 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-neutral-500">
            {queue.length} in queue
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 relative">
        <AnimatePresence>
          {!hasApiKey && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-8 text-center"
            >
              <div className="flex flex-col items-center gap-6 max-w-xs">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
                  <Key className="w-8 h-8 text-neutral-400" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-bold text-lg">API Key Required</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    SkulOS uses **BYOK** (Bring Your Own Key) to remain free for everyone. Please add your Gemini API key in settings to enable the Copilot.
                  </p>
                </div>
                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={onOpenSettings}
                    className="w-full py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
                  >
                    Go to Settings <ExternalLink className="w-4 h-4" />
                  </button>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-neutral-400 hover:text-black transition-colors"
                  >
                    Get a free API key here
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-3 max-w-[90%]",
              msg.role === "user" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === "user" ? "bg-neutral-100" : "bg-black"
            )}>
              {msg.role === "user" ? <User className="w-4 h-4 text-black" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === "user" ? "bg-neutral-50 text-black" : "bg-white border border-neutral-100 text-black",
              msg.type === "editProposal" ? "w-full max-w-full" : ""
            )}>
              {i === 0 && msg.role === "assistant" && (
                <img src={ILLUSTRATIONS.boyAndGirlHoldingPen} alt="AI Copilot" className="w-full h-32 object-contain opacity-80 mb-4" referrerPolicy="no-referrer" />
              )}
              <div className="prose prose-sm max-w-none">
                <Markdown>{msg.content}</Markdown>
              </div>
              {msg.type === "builder" && (
                <div className="mt-4 flex flex-col gap-2">
                  {msg.data.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                      <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                        <BrainCircuit className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-bold">{item.name} ({item.type})</span>
                    </div>
                  ))}
                  {msg.targetId && onNavigate && (
                    <button 
                      onClick={() => onNavigate(msg.targetId!)}
                      className="mt-2 w-full py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-neutral-800 transition-colors"
                    >
                      Go to new items
                    </button>
                  )}
                </div>
              )}
              {msg.type === "editProposal" && (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-neutral-500 uppercase">Original</span>
                      <div className="p-3 bg-red-50 text-red-900 rounded-lg text-xs whitespace-pre-wrap font-mono border border-red-100">
                        {msg.data.oldContent || "(Empty)"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-neutral-500 uppercase">Proposed</span>
                      <div className="p-3 bg-green-50 text-green-900 rounded-lg text-xs whitespace-pre-wrap font-mono border border-green-100">
                        {msg.data.newContent || "(Empty)"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => applyEdit(msg.data.fileId, msg.data.newContent)}
                      className="flex-1 py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Apply Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-neutral-50 text-neutral-400 italic text-sm">
              <span>Working...</span>
              <button 
                onClick={stopGeneration}
                className="p-1 hover:bg-neutral-200 rounded-md transition-colors text-neutral-500"
                title="Stop generation"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-neutral-50 flex flex-col gap-2">
        {isLive && (
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-900">Live Audio Session Active</span>
            </div>
            <button 
              onClick={stopLiveSession}
              className="p-1.5 bg-red-100 text-red-900 rounded-lg hover:bg-red-200 transition-colors"
            >
              <MicOff className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="relative flex items-center gap-2">
          <button
            onClick={isLive ? stopLiveSession : startLiveSession}
            disabled={isLiveConnecting}
            className={cn(
              "p-3 rounded-2xl transition-all shrink-0",
              isLive ? "bg-red-500 text-white" : "bg-neutral-100 text-black hover:bg-neutral-200",
              isLiveConnecting && "opacity-50 cursor-not-allowed"
            )}
            title="Start Live Audio Session"
          >
            {isLiveConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={isLoading ? "Queueing next message..." : "Ask anything..."}
              className="w-full pl-4 pr-12 py-3 bg-neutral-50 rounded-2xl text-sm outline-none focus:ring-1 focus:ring-black transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-xl hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
