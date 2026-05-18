import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Plus,
  Settings,
  LogOut,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  X,
  FileText,
  Download,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Type,
  Palette,
  ChevronDown,
  Check,
  Loader2,
  MousePointer2,
  Maximize,
  Minimize,
  LogIn,
  Cloud,
  RefreshCw,
  CloudUpload,
  CloudLightning,
  CloudOff,
  CloudDownload,
  Save,
  Undo2,
  Redo2,
  Search,
  Lock,
  Wand2,
  Bold,
  Italic,
  Strikethrough,
  List as ListIcon,
  CheckSquare,
  Heading1,
  Heading2,
  Table,
  Code,
  Quote,
} from "lucide-react";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";

import { Note, AppSettings, SaveStatus } from "./types";
import { COLORS, getNotePreview } from "./utils";
import { Tooltip } from "./components/Tooltip";
import { SimpleMarkdown } from "./components/SimpleMarkdown";
import { SettingsModal } from "./components/SettingsModal";
import { DriveSyncService } from "./driveSync";

declare global {
  interface Window {
    electronAPI?: {
      saveFile: (data: {
        content: string;
        defaultPath: string;
      }) => Promise<boolean>;
      getUserDataPath: () => Promise<string>;
      startLogin: () => Promise<boolean>;
      onLoginSuccess: (
        callback: (data: { idToken: string; accessToken: string }) => void,
      ) => void;
      onOpenFile: (
        callback: (
          event: any,
          data: { filename: string; content: string; filePath: string },
        ) => void,
      ) => void;
      readWorkspaceData: (filename: string) => Promise<string | null>;
      writeWorkspaceData: (data: {
        filename: string;
        data: string;
      }) => Promise<boolean>;
      deleteWorkspaceData: (filename: string) => Promise<boolean>;
    };
  }
}

const DEFAULT_NOTE: Note = {
  id: "local-default",
  userId: "local",
  content:
    "# Focus on what matters\n\nDouble-click this text to switch to **Edit Mode**.\n\n- No distractions\n- Local first\n- Markdown ready",
  timestamp: Date.now(),
  color: "#DFFF00",
  viewMode: "markdown",
};

// Removed DesktopAuthHandler

const App = () => {
  // --- STATE ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"notes" | "format">("notes");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<"view" | "color" | null>(
    null,
  );

  useEffect(() => {
    if (notes.length === 0 && sidebarMode === "format") {
       setSidebarMode("notes");
    }
    if (notes.length === 0 && isFocusMode) {
      setIsFocusMode(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => console.log(err));
      }
    }
  }, [notes.length, sidebarMode, isFocusMode]);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveSyncState, setDriveSyncState] = useState<
    "idle" | "checking" | "uploading" | "synced" | "error"
  >("idle");
  const [driveSyncMessage, setDriveSyncMessage] = useState(
    "Syncing Google Drive",
  );
  const [conflictData, setConflictData] = useState<Note[] | null>(null);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [toasts, setToasts] = useState<
    { id: string; message: string; type: "error" | "success" | "info" }[]
  >([]);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find & Replace State
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isReplaceExpanded, setIsReplaceExpanded] = useState(false);
  const [findText, setFindText] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findMatches, setFindMatches] = useState<
    { start: number; end: number }[]
  >([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const applyFormat = (
    prefix: string,
    suffix: string = "",
    defaultText: string = "",
  ) => {
    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (!activeNote) return;

    let el: HTMLInputElement | HTMLTextAreaElement | null = null;
    let isTitle = false;

    if (document.activeElement === titleInputRef.current && titleInputRef.current) {
      el = titleInputRef.current;
      isTitle = true;
    } else if (document.activeElement === textAreaRef.current && textAreaRef.current) {
      el = textAreaRef.current;
    } else {
      // Fallback to textArea if neither is explicitly focused 
      el = textAreaRef.current;
    }

    if (!el || el.selectionStart === undefined || el.selectionStart === null) return;

    const startPos = el.selectionStart;
    const endPos = el.selectionEnd || startPos;
    const text = el.value || "";
    
    let actualPrefix = prefix;
    let actualSuffix = suffix;
    
    // For line-based formatting (prefix starts with \n but we don't want \n if we are already at the start of a line)
    if (actualPrefix.startsWith("\n")) {
      const isStartOfLine = startPos === 0 || text[startPos - 1] === "\n";
      if (isStartOfLine) {
        actualPrefix = actualPrefix.substring(1); // remove the leading \n
      }
    }
    
    const selected =
      startPos !== endPos ? text.substring(startPos, endPos) : defaultText;
    
    const newFieldText =
      text.substring(0, startPos) +
      actualPrefix +
      selected +
      actualSuffix +
      text.substring(endPos);

    // reconstruct content
    let newContent = "";
    if (isTitle) {
      newContent = newFieldText + (body ? "\n\n" + body : "\n\n");
    } else {
      newContent = title + "\n\n" + newFieldText;
    }

    handleUpdateNote(activeNote.id, { content: newContent });

    setTimeout(() => {
      if (el) {
        el.focus();
        const newCursorPos = startPos + actualPrefix.length + selected.length;
        el.setSelectionRange(
          startPos + actualPrefix.length,
          newCursorPos,
        );
      }
    }, 0);
  };

  // History State
  const [history, setHistory] = useState<
    Record<string, { past: string[]; future: string[] }>
  >({});
  const lastSavedContentRef = useRef<Record<string, string>>({});
  const isUndoingRef = useRef<boolean>(false);
  const lastContentRef = useRef<string>("");
  const lastActionRef = useRef<"insert" | "delete" | "idle">("idle");
  const currentNoteIdRef = useRef<string | null>(null);

  const showToast = useCallback(
    (message: string, type: "error" | "success" | "info" = "info") => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const [appSettings, setAppSettings] = useState(() => {
    return {
      autoSave: true,
      fontSize: "16px",
      fontFamily: "monospace",
      theme: "midnight",
    };
  });

  // Desktop async read
  useEffect(() => {
    window.electronAPI?.readWorkspaceData("settings.json").then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.theme === "Midnight") parsed.theme = "midnight";
          setAppSettings({
            autoSave: parsed.autoSave !== undefined ? parsed.autoSave : true,
            fontSize: parsed.fontSize || "16px",
            fontFamily: parsed.fontFamily || "monospace",
            theme: parsed.theme || "midnight",
          });
        } catch (e) {
          // ignore corrupt settings
        }
      }
    });
  }, []);

  useEffect(() => {
    const data = JSON.stringify(appSettings);
    window.electronAPI?.writeWorkspaceData({ filename: "settings.json", data });
  }, [appSettings]);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyHighlightRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFindReplaceOpen) {
      requestAnimationFrame(() => {
        if (isReplaceExpanded) {
          replaceInputRef.current?.focus();
        } else {
          findInputRef.current?.focus();
        }
      });
    }
  }, [isFindReplaceOpen, isReplaceExpanded]);

  const renderHighlights = useCallback(
    (text: string, offset: number) => {
      if (!activeSearchTerm || findMatches.length === 0)
        return <span>{text}</span>;

      const charStyles = new Array(text.length).fill(0); // 0 = none, 1 = match, 2 = current

      findMatches.forEach((m, idx) => {
        const mStart = Math.max(0, m.start - offset);
        const mEnd = Math.min(text.length, m.end - offset);
        const isCurrent = idx === currentMatchIndex;

        for (let k = mStart; k < mEnd; k++) {
          if (charStyles[k] !== 2) {
            charStyles[k] = isCurrent ? 2 : 1;
          }
        }
      });

      const elements: React.ReactNode[] = [];
      let currentStyle = text.length > 0 ? charStyles[0] : 0;
      let currentChunkStart = 0;

      for (let k = 1; k <= text.length; k++) {
        if (k === text.length || charStyles[k] !== currentStyle) {
          const chunk = text.slice(currentChunkStart, k);
          if (currentStyle === 0) {
            elements.push(
              <span key={`text-${currentChunkStart}`}>{chunk}</span>,
            );
          } else {
            elements.push(
              <mark
                key={`mark-${currentChunkStart}`}
                className={`text-transparent rounded-sm ${currentStyle === 2 ? "bg-orange-500/60" : "bg-orange-500/20"}`}
              >
                {chunk}
              </mark>,
            );
          }
          currentChunkStart = k;
          if (k < text.length) currentStyle = charStyles[k];
        }
      }

      return elements;
    },
    [activeSearchTerm, findMatches, currentMatchIndex],
  );

  // --- FIREBASE SYNC & LOCAL STORAGE ---
  useEffect(() => {
    // Initial artificial delay for splash screen aesthetics
    const splashTimer = setTimeout(() => {
      setIsAppLoaded(true);
    }, 1500);

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Load local notes
        try {
          const saved =
            await window.electronAPI?.readWorkspaceData("notes.json");
          const lastActive = await window.electronAPI?.readWorkspaceData(
            "lastActiveNoteId.txt",
          );

          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.length > 0) {
              setNotes(parsed);
              if (lastActive && parsed.some((n: Note) => n.id === lastActive)) {
                setActiveNoteId(lastActive);
              } else {
                setActiveNoteId(parsed[0].id);
              }
            } else {
              setNotes([]);
              setActiveNoteId("");
            }
          } else {
            setNotes([]);
            setActiveNoteId("");
          }
        } catch (e) {
          setNotes([]);
          setActiveNoteId("");
        }
      }
    });
    return () => {
      unsubAuth();
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to Firebase notes
    const q = query(collection(db, `users/${user.uid}/notes`));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fbNotes: Note[] = [];
        snapshot.forEach((docSnap) => {
          fbNotes.push(docSnap.data() as Note);
        });

        // Sort by timestamp desc
        fbNotes.sort((a, b) => b.timestamp - a.timestamp);

        if (fbNotes.length > 0) {
          setNotes(fbNotes);
          window.electronAPI
            ?.readWorkspaceData("lastActiveNoteId.txt")
            .then((lastActive) => {
              if (lastActive && fbNotes.some((n) => n.id === lastActive)) {
                if (!activeNoteId) setActiveNoteId(lastActive);
              } else if (
                !activeNoteId ||
                !fbNotes.find((n) => n.id === activeNoteId)
              ) {
                setActiveNoteId(fbNotes[0].id);
              }
            });
        } else {
          setNotes([]);
          setActiveNoteId("");
        }
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${user.uid}/notes`,
        );
      },
    );

    return unsubscribe;
  }, [user, activeNoteId]);

  // Save local changes explicitly (Auto-save) if not logged in
  useEffect(() => {
    if (!user && isAppLoaded) {
      const data = JSON.stringify(notes);
      window.electronAPI?.writeWorkspaceData({ filename: "notes.json", data });
    }
  }, [notes, user, isAppLoaded]);

  useEffect(() => {
    if (activeNoteId) {
      window.electronAPI?.writeWorkspaceData({
        filename: "lastActiveNoteId.txt",
        data: activeNoteId,
      });
    }
  }, [activeNoteId]);

  // --- THEME EFFECT ---
  useEffect(() => {
    const themeClass = `theme-${appSettings.theme || "midnight"}`;
    // Remove old theme classes
    document.documentElement.classList.remove(
      "theme-midnight",
      "theme-paper",
      "theme-sepia",
    );
    document.documentElement.classList.add(themeClass);
    document.body.className = themeClass;
  }, [appSettings.theme]);

  // ELECTRON SPECIFIC - Handle IPC
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onOpenFile((event, data) => {
        const newNoteId = `local-${Date.now()}`;
        const newNote: Note = {
          id: newNoteId,
          userId: "local",
          content: data.content,
          timestamp: Date.now(),
          color:
            COLORS.tagColors[
              Math.floor(Math.random() * COLORS.tagColors.length)
            ],
          viewMode: "markdown",
        };
        // Use functional setState to ensure we have the latest without adding it as a dependency
        setNotes((prev) => {
          // ensure we don't accidentally add the exact same file twice quickly
          if (
            prev.some(
              (n) =>
                n.content === data.content && n.timestamp > Date.now() - 2000,
            )
          ) {
            return prev;
          }
          return [newNote, ...prev];
        });
        setActiveNoteId(newNote.id);
        showToast(`Opened ${data.filename}`, "success");
      });

      window.electronAPI.onLoginSuccess(async ({ idToken, accessToken }) => {
        try {
          if (idToken) {
            const credential = GoogleAuthProvider.credential(
              idToken,
              accessToken || undefined,
            );
            await signInWithCredential(auth, credential);
            if (accessToken) {
              window.electronAPI?.writeWorkspaceData({
                filename: "drive_token.txt",
                data: accessToken,
              });
              performDriveSync(accessToken);
            }
            showToast("Signed in successfully", "success");
          }
        } catch (e: any) {
          console.error("Desktop login completion failed", e);
          showToast("Desktop Authentication failed.", "error");
        }
      });
    }
  }, []); // Run once on mount

  // --- DERIVED STATE ---
  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || notes[0],
    [notes, activeNoteId],
  );

  const { title, body } = useMemo(() => {
    const content = activeNote?.content || "";
    const idx = content.indexOf("\n");
    if (idx === -1) return { title: content, body: "" };
    return {
      title: content.slice(0, idx),
      body: content.slice(idx + 1).replace(/^\n/, ""),
    };
  }, [activeNote?.content]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeNote) return;
    const newTitle = e.target.value;
    handleUpdateNote(activeNote.id, {
      content: newTitle + (body ? "\n\n" + body : "\n\n"),
    });
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeNote) return;
    const newBody = e.target.value;
    handleUpdateNote(activeNote.id, { content: title + "\n\n" + newBody });
  };

  // --- ACTIONS ---

  // Initialize history content
  useEffect(() => {
    if (
      activeNote &&
      lastSavedContentRef.current[activeNote.id] === undefined
    ) {
      lastSavedContentRef.current[activeNote.id] = activeNote.content;
    }
  }, [activeNote?.id, activeNote?.content]);

  // Track changes on word boundaries or large changes
  useEffect(() => {
    if (!activeNote) return;

    if (currentNoteIdRef.current !== activeNote.id) {
      currentNoteIdRef.current = activeNote.id;
      lastContentRef.current = activeNote.content;
      lastActionRef.current = "idle";
      return;
    }

    if (isUndoingRef.current) {
      lastContentRef.current = activeNote.content;
      return;
    }

    const currentContent = activeNote.content;
    const previousContent = lastContentRef.current;

    if (currentContent === previousContent) return;

    const diff = currentContent.length - previousContent.length;
    let action: "insert" | "delete" | "idle" = "idle";
    if (diff > 0) action = "insert";
    else if (diff < 0) action = "delete";

    const isLargeChange = Math.abs(diff) > 1;
    let isWordBoundary = false;
    if (diff === 1) {
      const addedChar = currentContent.slice(-1);
      if (addedChar === " " || addedChar === "\n") {
        isWordBoundary = true;
      }
    }
    const isDirectionChange =
      action !== "idle" &&
      lastActionRef.current !== "idle" &&
      action !== lastActionRef.current;

    const noteId = activeNote.id;
    const prevSaved =
      lastSavedContentRef.current[noteId] !== undefined
        ? lastSavedContentRef.current[noteId]
        : "";

    if (isLargeChange || isWordBoundary || isDirectionChange) {
      setHistory((prev) => {
        const past = prev[noteId]?.past || [];
        if (past.length > 0 && past[past.length - 1] === prevSaved) {
          return prev;
        }
        let newPast = [...past, prevSaved];
        if (newPast.length > 50) newPast = newPast.slice(newPast.length - 50);
        return {
          ...prev,
          [noteId]: { past: newPast, future: [] },
        };
      });
      lastSavedContentRef.current[noteId] = previousContent;
    }

    lastContentRef.current = currentContent;
    if (action !== "idle") lastActionRef.current = action;
  }, [activeNote?.content, activeNote?.id]);

  const handleCreateNote = useCallback(async () => {
    setSidebarMode("notes");

    const newNoteId = user ? crypto.randomUUID() : `local-${Date.now()}`;
    const newNote: Note = {
      id: newNoteId,
      userId: user ? user.uid : "local",
      content: "Untitled\n\n",
      timestamp: Date.now(),
      color: COLORS.accent,
      viewMode: "text",
    };

    if (user) {
      setSaveStatus("saving");
      try {
        await setDoc(doc(db, `users/${user.uid}/notes/${newNoteId}`), newNote);
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
        handleFirestoreError(
          e,
          OperationType.CREATE,
          `users/${user.uid}/notes/${newNoteId}`,
        );
        return;
      }
    } else {
      setNotes((prev) => [newNote, ...prev]);
    }
    setActiveNoteId(newNote.id);
    if (isFocusMode) setIsFocusMode(false); // Drop out of focus mode to see new note
  }, [isFocusMode, user]);

  const handleUpdateNote = useCallback(
    (id: string, updates: Partial<Note>) => {
      const minUpdatedNote = {
        ...activeNote,
        ...updates,
        timestamp: Date.now(),
      };
      if (user) minUpdatedNote.userId = user.uid;

      if (user) {
        if (appSettings.autoSave) setSaveStatus("saving");
        setNotes((prev) => prev.map((n) => (n.id === id ? minUpdatedNote : n)));

        if (appSettings.autoSave) {
          setDoc(doc(db, `users/${user.uid}/notes/${id}`), minUpdatedNote)
            .then(() => {
              setSaveStatus("saved");
            })
            .catch((e) => {
              setSaveStatus("error");
              handleFirestoreError(
                e,
                OperationType.UPDATE,
                `users/${user.uid}/notes/${id}`,
              );
            });
        }
      } else {
        setNotes((prev) => prev.map((n) => (n.id === id ? minUpdatedNote : n)));
      }

      if (updates.viewMode === "markdown") {
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 400);
      }
    },
    [activeNote, user, appSettings.autoSave],
  );

  const handleUndo = useCallback(() => {
    if (!activeNote) return;
    const noteId = activeNote.id;
    setHistory((prev) => {
      const currentHistory = prev[noteId] || { past: [], future: [] };
      const currentContent = activeNote.content;
      const prevSaved =
        lastSavedContentRef.current[noteId] !== undefined
          ? lastSavedContentRef.current[noteId]
          : "";

      isUndoingRef.current = true;
      lastActionRef.current = "idle"; // Reset action

      let nextContentToApply;
      let newPast = [...currentHistory.past];
      let newFuture = [...currentHistory.future];

      if (currentContent !== prevSaved) {
        // Unsaved changes directly revert to last saved state
        nextContentToApply = prevSaved;
        newFuture = [currentContent, ...newFuture];
      } else {
        // No unsaved changes, pop from past
        if (newPast.length === 0) {
          isUndoingRef.current = false;
          return prev; // Nothing to undo
        }
        nextContentToApply = newPast.pop() as string;
        newFuture = [currentContent, ...newFuture];
      }

      handleUpdateNote(noteId, { content: nextContentToApply });
      lastSavedContentRef.current[noteId] = nextContentToApply;

      setTimeout(() => {
        isUndoingRef.current = false;
      }, 100);

      return {
        ...prev,
        [noteId]: { past: newPast, future: newFuture },
      };
    });
  }, [activeNote, handleUpdateNote]);

  const handleRedo = useCallback(() => {
    if (!activeNote) return;
    const noteId = activeNote.id;
    setHistory((prev) => {
      const currentHistory = prev[noteId];
      if (!currentHistory || currentHistory.future.length === 0) return prev;

      const newFuture = [...currentHistory.future];
      const nextContentToApply = newFuture.shift() as string;
      const currentContent = activeNote.content;

      isUndoingRef.current = true;
      lastActionRef.current = "idle"; // Reset action
      handleUpdateNote(noteId, { content: nextContentToApply });
      lastSavedContentRef.current[noteId] = nextContentToApply;

      let newPast = [...currentHistory.past, currentContent];
      if (newPast.length > 15) newPast = newPast.slice(newPast.length - 15);

      setTimeout(() => {
        isUndoingRef.current = false;
      }, 100);

      return {
        ...prev,
        [noteId]: { past: newPast, future: newFuture },
      };
    });
  }, [activeNote, handleUpdateNote]);

  const handleDeleteNote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/notes/${id}`));
        const newNotes = notes.filter((n) => n.id !== id);
        if (activeNoteId === id) {
          setActiveNoteId(newNotes.length > 0 ? newNotes[0].id : "");
        }
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `users/${user.uid}/notes/${id}`,
        );
      }
    } else {
      const newNotes = notes.filter((n) => n.id !== id);
      setNotes(newNotes);
      if (activeNoteId === id) {
        setActiveNoteId(newNotes.length > 0 ? newNotes[0].id : "");
      }
    }
  };

  const performDriveSync = async (token: string, background = false) => {
    if (!background) {
      setIsDriveSyncing(true);
      setDriveSyncMessage("Checking Google Drive...");
    }
    setDriveSyncState("checking");
    try {
      const drive = new DriveSyncService(token);
      let folderId = await drive.getFolderId();
      if (!folderId) {
        setDriveSyncMessage("Setting up sync folder...");
        folderId = await drive.createFolder();
      }

      setDriveSyncMessage("Downloading latest tabs...");
      const driveDataRaw = await drive.downloadData(folderId, (msg) => {
        setDriveSyncMessage(msg);
      });

      if (driveDataRaw && driveDataRaw.length > 0) {
        // Enforce the current user's ID
        const driveData = driveDataRaw.map((note) => ({
          ...note,
          userId: auth.currentUser ? auth.currentUser.uid : "local",
        }));

        // Very basic heuristic for conflict: if local has more than default notes, and differs in count or timestamp of first note
        if (
          notes.length > 0 &&
          notes[0].id !== "local-default" &&
          !background
        ) {
          const localLatest = notes[0].timestamp || 0;
          const driveLatest = driveData[0].timestamp || 0;
          if (
            Math.abs(localLatest - driveLatest) > 60000 &&
            localLatest > driveLatest
          ) {
            // Local is significantly newer, or differs
            setConflictData(driveData);
            setDriveSyncMessage("Conflict detected");
            return; // pause sync and wait for user resolution
          }
        }

        // Push explicitly to Firestore to bypass the update lock if needed
        if (auth.currentUser) {
          driveData.forEach(async (note) => {
            try {
              await setDoc(
                doc(db, `users/${auth.currentUser!.uid}/notes/${note.id}`),
                note,
              );
            } catch (e) {
              console.error("Failed writing synced note to firestore", e);
            }
          });
        }

        setNotes(driveData);
        setActiveNoteId(driveData[0].id);
        if (!background) showToast("Synced tabs from Google Drive", "success");
      }
      setDriveSyncState("synced");
    } catch (e: any) {
      console.error(e);
      setDriveSyncState("error");
      if (e.message === "UNAUTHORIZED") {
        window.electronAPI?.deleteWorkspaceData("drive_token.txt");
        if (!background)
          showToast(
            "Drive Sync Session expired. Please re-login to sync.",
            "error",
          );
      } else {
        if (!background) showToast("Google Drive Sync failed.", "error");
      }
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const handleAuth = async () => {
    if (user) {
      try {
        await signOut(auth);
        window.electronAPI?.deleteWorkspaceData("drive_token.txt");
        showToast("Signed out successfully", "info");
      } catch (e: any) {
        showToast("Failed to sign out", "error");
      }
    } else {
      if (window.electronAPI) {
        // Desktop Auth Flow
        try {
          await window.electronAPI.startLogin();
          // The result will be handled by the onLoginSuccess IPC listener
        } catch (e) {
          showToast("Failed to start desktop auth.", "error");
        }
      } else {
        // Web Auth Flow
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            window.electronAPI?.writeWorkspaceData({
              filename: "drive_token.txt",
              data: credential.accessToken,
            });
            performDriveSync(credential.accessToken);
          }
          showToast("Signed in successfully", "success");
        } catch (e: any) {
          if (
            e?.code === "auth/popup-closed-by-user" ||
            e?.code === "auth/cancelled-popup-request"
          ) {
            console.log("Authentication cancelled by user.");
          } else {
            console.error("Auth error", e);
            showToast("Authentication failed. Please try again.", "error");
          }
        }
      }
    }
  };

  const handleExport = async () => {
    if (!activeNote || !activeNote.content) {
      showToast("Nothing to export", "info");
      return;
    }

    const extension = activeNote.viewMode === "markdown" ? ".md" : ".txt";
    const mimeType =
      activeNote.viewMode === "markdown" ? "text/markdown" : "text/plain";

    if (window.electronAPI) {
      const saved = await window.electronAPI.saveFile({
        content: activeNote.content,
        defaultPath: `${title || "untitled"}${extension}`,
      });
      if (saved) {
        showToast("Exported successfully", "success");
      }
    } else {
      const blob = new Blob([activeNote.content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "untitled"}${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Exported successfully", "success");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isText = file.name.endsWith(".txt");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const newNoteId = user ? crypto.randomUUID() : `local-${Date.now()}`;
      const newNote: Note = {
        id: newNoteId,
        userId: user ? user.uid : "local",
        content,
        timestamp: Date.now(),
        color:
          COLORS.tagColors[Math.floor(Math.random() * COLORS.tagColors.length)],
        viewMode: isText ? "text" : "markdown",
      };

      if (user) {
        setSaveStatus("saving");
        try {
          await setDoc(
            doc(db, `users/${user.uid}/notes/${newNoteId}`),
            newNote,
          );
          setSaveStatus("saved");
          showToast("Notes imported successfully", "success");
        } catch (err) {
          setSaveStatus("error");
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${user.uid}/notes/${newNoteId}`,
          );
          showToast("Failed to import note", "error");
          return;
        }
      } else {
        setNotes((prev) => [newNote, ...prev]);
        showToast("Notes imported locally", "success");
      }
      setActiveNoteId(newNote.id);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // Background Drive Sync
  useEffect(() => {
    if (notes.length === 0 || isDriveSyncing) return;

    // We get the token asynchronously
    const timer = setTimeout(async () => {
      const token =
        await window.electronAPI?.readWorkspaceData("drive_token.txt");
      if (!token) return;

      setDriveSyncState("uploading");
      try {
        const drive = new DriveSyncService(token);
        let folderId = await drive.getFolderId();
        if (!folderId) {
          folderId = await drive.createFolder();
        }
        await drive.uploadData(folderId, notes, (msg) => {
          setDriveSyncMessage(msg);
        });
        setDriveSyncState("synced");
      } catch (e: any) {
        setDriveSyncState("error");
        if (e.message === "UNAUTHORIZED") {
          window.electronAPI?.deleteWorkspaceData("drive_token.txt");
        }
      }
    }, 8000); // 8 seconds debounce

    return () => clearTimeout(timer);
  }, [notes, isDriveSyncing]);

  // Initial Drive Sync if token available
  useEffect(() => {
    if (user && !isDriveSyncing && !isAppLoaded) {
      window.electronAPI?.readWorkspaceData("drive_token.txt").then((token) => {
        if (token) {
          performDriveSync(token);
        }
      });
    }
  }, [user, isAppLoaded, isDriveSyncing]);

  // --- SHORTCUTS ENGINE ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F : Find
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsFindReplaceOpen(true);
        setIsReplaceExpanded(false);
        if (activeNote && activeNote.viewMode === "markdown") {
          handleUpdateNote(activeNote.id, { viewMode: "text" });
        }
      }
      // Ctrl+H : Replace
      if (e.ctrlKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setIsFindReplaceOpen(true);
        setIsReplaceExpanded(true);
        if (activeNote && activeNote.viewMode === "markdown") {
          handleUpdateNote(activeNote.id, { viewMode: "text" });
        }
      }
      // Ctrl+T : New Note
      if (
        e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "t"
      ) {
        e.preventDefault();
        handleCreateNote();
      }
      // Ctrl+E : Toggle Markdown/Text Editor
      if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (activeNote) {
          handleUpdateNote(activeNote.id, {
            viewMode: activeNote.viewMode === "markdown" ? "text" : "markdown",
          });
        }
      }
      // Ctrl+Alt+S : Export Note
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (activeNote) {
          handleExport();
        }
      }
      // Ctrl+Z : Undo
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z : Redo
      if (
        (e.ctrlKey && e.key.toLowerCase() === "y") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+Del : Delete Note with prompt
      if (e.ctrlKey && (e.key === "Delete" || e.key === "Del")) {
        e.preventDefault();
        if (activeNote) {
          setDeletePromptId(activeNote.id);
        }
      }
      // Escape : Handle context exits
      if (e.key === "Escape") {
        if (activeDropdown) {
          setActiveDropdown(null);
        } else if (isFindReplaceOpen) {
          e.preventDefault();
          setIsFindReplaceOpen(false);
          setFindText("");
          setActiveSearchTerm("");
        } else if (deletePromptId) {
          setDeletePromptId(null);
        } else if (isFocusMode) {
          setIsFocusMode(false);
          if (document.fullscreenElement) {
            document
              .exitFullscreen()
              .catch((err) => console.log("Exit fullscreen failed:", err));
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeNote,
    isFocusMode,
    handleCreateNote,
    handleUpdateNote,
    handleExport,
    handleUndo,
    handleRedo,
    deletePromptId,
    isFindReplaceOpen,
    activeDropdown,
  ]);

  // --- RESIZE LOGIC ---
  const startResizing = (e: React.MouseEvent) => {
    if (sidebarMode === "format") return;
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const stopResizing = () => setIsResizing(false);
    const resize = (e: MouseEvent) => {
      if (isResizing && !isSidebarMinimized) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 150 && newWidth < 600) setSidebarWidth(newWidth);
      }
    };
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, isSidebarMinimized]);

  // Removed isDesktopAuth check

  // --- FIND & REPLACE LOGIC ---
  const performSearch = useCallback(() => {
    if (!isFindReplaceOpen || !findText || !activeNote) {
      setFindMatches([]);
      setCurrentMatchIndex(-1);
      setActiveSearchTerm("");
      return;
    }

    const text = activeNote.content;
    const matches: { start: number; end: number }[] = [];
    let i = 0;
    while (i < text.length) {
      const idx = text.toLowerCase().indexOf(findText.toLowerCase(), i);
      if (idx === -1) break;
      matches.push({ start: idx, end: idx + findText.length });
      i = idx + findText.length;
    }
    setFindMatches(matches);
    setActiveSearchTerm(findText);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [findText, activeNote, isFindReplaceOpen]);

  // Recalculate matches if content changes but only with the active search term
  useEffect(() => {
    if (!isFindReplaceOpen || !activeSearchTerm || !activeNote) return;
    const text = activeNote.content;
    const matches: { start: number; end: number }[] = [];
    let i = 0;
    while (i < text.length) {
      const idx = text.toLowerCase().indexOf(activeSearchTerm.toLowerCase(), i);
      if (idx === -1) break;
      matches.push({ start: idx, end: idx + activeSearchTerm.length });
      i = idx + 1; // Advance by 1 to catch overlapping matches
    }
    setFindMatches(matches);
    setCurrentMatchIndex((prev) =>
      matches.length > 0 ? (prev >= matches.length || prev < 0 ? 0 : prev) : -1,
    );
  }, [activeNote?.content, activeSearchTerm, isFindReplaceOpen]);

  useEffect(() => {
    if (isFindReplaceOpen && findMatches.length > 0 && currentMatchIndex >= 0) {
      const match = findMatches[currentMatchIndex];
      const titleLen = title.length;

      requestAnimationFrame(() => {
        // Match inside title
        if (match.start <= titleLen && titleInputRef.current) {
          titleInputRef.current.setSelectionRange(
            match.start,
            Math.min(match.end, titleLen),
          );
        }
        // Match inside body
        else if (match.start > titleLen && textAreaRef.current) {
          const bodyStart = match.start - titleLen - 2; // -2 for \n\n
          const bodyEnd = match.end - titleLen - 2;

          if (bodyStart >= 0) {
            textAreaRef.current.setSelectionRange(bodyStart, bodyEnd);

            // Hack for smooth scrolling to selection
            const fullText = textAreaRef.current.value;
            const textBefore = fullText.substring(0, bodyStart);
            const lines = textBefore.split("\n").length;
            const lineHeight = parseInt(
              getComputedStyle(textAreaRef.current).lineHeight || "24",
            );
            textAreaRef.current.scrollTop = Math.max(
              0,
              (lines - 2) * lineHeight,
            );
          }
        }
      });
    }
  }, [currentMatchIndex, findMatches, isFindReplaceOpen, title.length]);

  const handleFindNext = () => {
    if (findText !== activeSearchTerm) {
      performSearch();
    } else if (findMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % findMatches.length);
    } else {
      performSearch();
    }
  };

  const handleFindPrev = () => {
    if (findText !== activeSearchTerm) {
      performSearch(); // actually we could search and set index to end, but this is simple enough
    } else if (findMatches.length > 0) {
      setCurrentMatchIndex(
        (prev) => (prev - 1 + findMatches.length) % findMatches.length,
      );
    } else {
      performSearch();
    }
  };

  const handleReplace = () => {
    if (findMatches.length === 0 || currentMatchIndex < 0 || !activeNote)
      return;
    const match = findMatches[currentMatchIndex];
    const text = activeNote.content;
    const newText =
      text.substring(0, match.start) + replaceText + text.substring(match.end);

    handleUpdateNote(activeNote.id, { content: newText });
  };

  const handleReplaceAll = () => {
    if (!findText || !activeNote) return;
    const regex = new RegExp(
      findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    const newText = activeNote.content.replace(regex, replaceText);
    handleUpdateNote(activeNote.id, { content: newText });
  };

  // --- CLICK OUTSIDE DROPDOWN LOGIC ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activeDropdown && !target.closest(".js-dropdown-container")) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdown]);

  if (!isAppLoaded)
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-main relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-accent-mute blur-[100px] pointer-events-none" />

        <div className="z-10 flex flex-col items-center animate-pulse">
          <span className="text-6xl font-black italic tracking-tighter text-accent">
            TABBY
          </span>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-accent/50 to-transparent mt-4 mb-6"></div>
          <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.3em] uppercase opacity-70 text-primary">
            <Loader2 className="animate-spin" size={12} />
            <span>Starting Workspace</span>
          </div>
        </div>
      </div>
    );

  if (isDriveSyncing)
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-main relative overflow-hidden z-50">
        <div className="w-[80vw] h-[80vh] bg-panel border border-border-color/40 shadow-2xl rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-accent-mute blur-[100px] pointer-events-none" />
          <div className="z-10 flex flex-col items-center animate-pulse">
            <Loader2 className="animate-spin text-accent mb-6" size={48} />
            <span className="text-4xl font-black italic tracking-tighter text-accent">
              TABBY
            </span>
            <div className="h-[1px] w-full max-w-sm bg-gradient-to-r from-transparent via-accent/50 to-transparent mt-4 mb-6"></div>
            <div className="flex items-center gap-3 font-mono text-xs tracking-[0.3em] uppercase opacity-70 text-primary">
              <span>{driveSyncMessage}</span>
            </div>
          </div>
        </div>
      </div>
    );

  if (conflictData)
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-main relative overflow-hidden z-50 p-6">
        <div className="w-full max-w-2xl bg-panel border border-border-color shadow-2xl rounded-2xl flex flex-col items-center p-12 relative overflow-hidden">
          <AlertCircle size={48} className="text-yellow-500 mb-6" />
          <h2 className="text-2xl font-bold text-primary mb-2 tracking-tighter">
            Sync Conflict Detected
          </h2>
          <p className="text-muted text-sm text-center mb-8 max-w-md">
            Your local device has different recent notes compared to your Google
            Drive backup. Which version would you like to keep?
          </p>

          <div className="flex w-full gap-6">
            <div
              className="flex-1 bg-panel border border-border-color hover:border-gray-500 transition-colors p-6 rounded-lg cursor-pointer flex flex-col items-center"
              onClick={() => {
                setNotes(conflictData);
                setActiveNoteId(conflictData[0].id);
                if (auth.currentUser) {
                  conflictData.forEach(async (note) => {
                    try {
                      await setDoc(
                        doc(
                          db,
                          `users/${auth.currentUser!.uid}/notes/${note.id}`,
                        ),
                        note,
                      );
                    } catch (e) {
                      console.error(
                        "Failed writing synced note to firestore",
                        e,
                      );
                    }
                  });
                }
                setConflictData(null);
                showToast(
                  "Applied Drive backup to your local workspace",
                  "success",
                );
              }}
            >
              <CloudDownload size={32} className="text-blue-400 mb-4" />
              <h3 className="font-bold text-primary mb-2">Keep Drive Backup</h3>
              <p className="text-xs text-muted text-center">
                Discard local changes and load tabs from Google Drive.
              </p>
            </div>

            <div
              className="flex-1 bg-panel border border-border-color hover:border-gray-500 transition-colors p-6 rounded-lg cursor-pointer flex flex-col items-center"
              onClick={() => {
                setConflictData(null);
                showToast(
                  "Kept local workspace. Drive will be updated soon.",
                  "info",
                );
              }}
            >
              <Save size={32} className="text-accent mb-4" />
              <h3 className="font-bold text-primary mb-2">
                Keep Local Changes
              </h3>
              <p className="text-xs text-muted text-center">
                Override Google Drive with your current local tabs.
              </p>
            </div>
          </div>
        </div>
      </div>
    );



  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-mono selection:bg-accent-mute selection:text-primary relative bg-main text-primary transition-colors duration-200">
      {/* TOASTS CONTAINER */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-4 fade-in duration-300 ${
              t.type === "error"
                ? "bg-red-500/10 border-red-500/50 text-red-400"
                : t.type === "success"
                  ? "bg-green-500/10 border-green-500/50 text-green-400"
                  : "bg-panel border-border-color text-primary"
            }`}
          >
            {t.type === "error" && <AlertCircle size={16} />}
            {t.type === "success" && <CheckCircle2 size={16} />}
            <span className="text-xs uppercase tracking-widest font-bold">
              {t.message}
            </span>
          </div>
        ))}
      </div>

      <input
        type="file"
        accept=".md,.txt"
        ref={fileInputRef}
        onChange={handleImport}
        className="hidden"
      />

      {/* FLOATING FOCUS MODE EXIT */}
      {isFocusMode && (
        <button
          onClick={() => {
            setIsFocusMode(false);
            if (document.fullscreenElement)
              document.exitFullscreen().catch((e) => console.log(e));
          }}
          className="absolute top-6 right-8 z-50 p-2 text-muted hover:text-primary opacity-20 hover:opacity-100 transition-all flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] bg-black/20 rounded-full pr-4"
        >
          <Minimize size={14} /> exit focus (esc)
        </button>
      )}

      {/* FLOATING FIND & REPLACE CARD */}
      {isFindReplaceOpen && !isFocusMode && (
        <div
          className={`absolute top-16 right-8 z-40 bg-panel border ${appSettings.theme === "light" ? "border-gray-200" : "border-gray-800"} shadow-2xl rounded overflow-hidden w-72 flex flex-col animate-in slide-in-from-top-4 fade-in duration-200`}
        >
          <div className="flex items-center gap-1.5 p-1 border-b border-border-color">
            <button
              onClick={() => setIsReplaceExpanded(!isReplaceExpanded)}
              className="p-1 rounded text-muted hover:text-primary transition-colors focus:outline-none"
              title="Expand for replace"
            >
              <ChevronRight
                size={16}
                className={`transition-transform duration-200 ${isReplaceExpanded ? "rotate-90" : ""}`}
              />
            </button>
            <div
              className={`flex flex-col w-full relative ${appSettings.theme === "light" ? "bg-white" : "bg-black/20"} rounded-sm border border-border-color`}
            >
              <div className="flex items-center px-1.5 py-0 relative">
                <input
                  ref={findInputRef}
                  autoFocus
                  type="text"
                  placeholder="Find"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="w-full bg-transparent text-sm placeholder-muted text-primary outline-none py-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.shiftKey ? handleFindPrev() : handleFindNext();
                    }
                    if (e.key === "Escape") setIsFindReplaceOpen(false);
                  }}
                />
                <span className="text-[10px] text-muted whitespace-nowrap px-1">
                  {findMatches.length > 0
                    ? `${currentMatchIndex + 1} of ${findMatches.length}`
                    : "0 of 0"}
                </span>
                <div className="flex border-l border-border-color/50 pl-1 ml-1 h-full items-center">
                  <button
                    onClick={handleFindPrev}
                    className="p-1 hover:bg-white/10 rounded text-muted hover:text-primary"
                    title="Previous (Shift+Enter)"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleFindNext}
                    className="p-1 hover:bg-white/10 rounded text-muted hover:text-primary"
                    title="Next (Enter)"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              {isReplaceExpanded && (
                <div className="flex items-center px-2 py-0.5 border-t border-border-color relative">
                  <input
                    ref={replaceInputRef}
                    type="text"
                    placeholder="Replace"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    className="w-full bg-transparent text-sm placeholder-muted text-primary outline-none py-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleReplace();
                      if (e.key === "Escape") setIsFindReplaceOpen(false);
                    }}
                  />
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={handleReplace}
                      className="p-[3px] px-2 text-[10px] uppercase font-bold tracking-wider hover:bg-white/10 rounded border border-border-color text-muted hover:text-primary"
                      title="Replace"
                    >
                      Rep
                    </button>
                    <button
                      onClick={handleReplaceAll}
                      className="p-[3px] px-2 text-[10px] uppercase font-bold tracking-wider hover:bg-white/10 rounded border border-border-color text-muted hover:text-primary"
                      title="Replace All"
                    >
                      All
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setIsFindReplaceOpen(false);
                setFindText("");
                setActiveSearchTerm("");
              }}
              className="p-1 rounded text-muted hover:text-primary transition-colors focus:outline-none"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header
        className={`w-full px-12 flex justify-between items-center border-b border-border-color/20 z-20 shrink-0 bg-main transition-all duration-500 ease-in-out ${isFocusMode ? "h-0 opacity-0 overflow-hidden border-transparent" : "h-[68px] opacity-100"}`}
      >
        <div className="flex items-center mt-2 cursor-default select-none">
          <span className="text-3xl font-black italic tracking-tighter text-accent">
            TABBY
          </span>
        </div>

        <div className="flex gap-4 text-[10px] uppercase tracking-[0.2em] opacity-60 items-center text-primary">
          <Tooltip text={notes.length === 0 ? "No notes to focus on" : "Focus Mode (Esc to exit)"} position="bottom">
            <button
              onClick={() => {
                if (notes.length === 0) return;
                setIsFocusMode(true);
                document.documentElement
                  .requestFullscreen()
                  .catch((e) => console.log("Fullscreen failed:", e));
              }}
              disabled={notes.length === 0}
              className={`flex items-center gap-2 transition-colors cursor-pointer active:scale-95 px-3 py-1.5 rounded-lg border border-transparent font-bold ${notes.length === 0 ? "opacity-30 cursor-not-allowed" : "hover:text-accent hover:border-border-color/50 hover:bg-black/10"}`}
            >
              <Maximize size={14} /> <span>focus</span>
            </button>
          </Tooltip>

          <div className="w-[1px] h-4 bg-border-color/30" />

          <Tooltip text="Application Settings" position="bottom">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hover:text-accent flex items-center gap-2 transition-colors cursor-pointer active:scale-95 px-3 py-1.5 rounded-lg border border-transparent hover:border-border-color/50 hover:bg-black/10 font-bold"
            >
              <Settings size={14} /> <span>settings</span>
            </button>
          </Tooltip>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* EDITOR AREA */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-transparent z-10 transition-all duration-500">
          {!activeNote ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="h-32 mb-8 text-muted flex items-center justify-center relative">
                <FileText size={64} strokeWidth={1} className="absolute rotate-[-12deg] -translate-x-8 opacity-40" />
                <FileText size={64} strokeWidth={1} className="absolute rotate-[12deg] translate-x-8 opacity-40 scale-90" />
                <FileText size={80} strokeWidth={1.5} className="relative z-10 text-primary opacity-80" />
              </div>
              <h2 className="text-3xl font-black italic tracking-tighter text-primary mb-4">TABBY is Empty</h2>
              <p className="text-sm text-muted max-w-sm mb-8 font-mono leading-relaxed">
                You have no active tabs. Create a new note to start writing, or import an existing one.
              </p>
              <button
                onClick={handleCreateNote}
                className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-panel hover:scale-[1.05] active:scale-95 transition-all shadow-md"
              >
                <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                <span className="font-bold tracking-[0.1em] uppercase text-xs">Create New Note</span>
              </button>
            </div>
          ) : activeNote.viewMode === "markdown" ? (
            <div
              className={`flex-1 overflow-y-auto custom-scrollbar scrollbar-flush ${isFocusMode ? "px-[10%] sm:px-[20%] py-12 sm:py-24" : "p-6 sm:p-12"}`}
            >
              <div 
                className="relative w-full mb-4 shrink-0 font-bold text-xl sm:text-2xl cursor-pointer"
                onDoubleClick={() => handleUpdateNote(activeNote.id, { viewMode: "text" })}
              >
                <div className="relative w-full bg-transparent text-primary m-0 p-0">
                  {title === "" ? "Untitled" : title.replace(/^#+\s*/, '')}
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-800/50 mb-6 shrink-0 transition-colors" />

              <SimpleMarkdown
                content={body}
                onDoubleClick={() =>
                  handleUpdateNote(activeNote.id, { viewMode: "text" })
                }
              />
            </div>
          ) : (
            <div
              className={`flex-1 flex flex-col w-full h-full relative ${isFocusMode ? "px-[10%] sm:px-[20%] py-12 sm:py-24" : "p-6 sm:p-12"}`}
            >
              <div className="relative w-full mb-4 shrink-0 font-bold text-xl sm:text-2xl">
                {isFindReplaceOpen && activeSearchTerm && (
                  <div className="absolute inset-0 pointer-events-none text-transparent break-words whitespace-pre overflow-hidden">
                    {renderHighlights(title, 0)}
                  </div>
                )}
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Untitled"
                  className="relative w-full bg-transparent text-primary outline-none border-none placeholder-muted transition-colors m-0 p-0"
                  spellCheck={false}
                />
              </div>

              <div className="w-full h-[1px] bg-gray-800/50 mb-6 shrink-0 transition-colors" />

              <div className="relative flex-1 w-full flex flex-col overflow-hidden">
                {isFindReplaceOpen && activeSearchTerm && (
                  <div
                    className="absolute inset-0 pointer-events-none text-transparent leading-relaxed text-lg break-words whitespace-pre-wrap pb-32 overflow-hidden m-0 p-0"
                    style={{ fontSize: appSettings.fontSize }}
                    ref={bodyHighlightRef}
                  >
                    {renderHighlights(body, title.length + 2)}
                  </div>
                )}
                <textarea
                  autoFocus
                  ref={textAreaRef}
                  value={body}
                  onChange={handleBodyChange}
                  onScroll={(e) => {
                    if (bodyHighlightRef.current) {
                      bodyHighlightRef.current.scrollTop =
                        e.currentTarget.scrollTop;
                    }
                  }}
                  placeholder="start typing..."
                  className="relative w-full h-full flex-1 bg-transparent text-lg text-primary/90 resize-none outline-none border-none placeholder-muted custom-scrollbar scrollbar-flush pb-32 m-0 p-0 leading-relaxed"
                  style={{ fontSize: appSettings.fontSize }}
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {/* FOOTER */}
          {activeNote && (
            <footer
              className={`border-t border-border-color/20 flex items-center bg-panel shrink-0 transition-all duration-500 ease-in-out relative ${isFocusMode ? "h-0 opacity-0 overflow-hidden border-transparent" : "h-10 sm:h-9 opacity-100"}`}
            >
            <div className="flex-1 w-full h-full flex items-center justify-between px-6 sm:px-8">
              <div className="flex items-center gap-4 sm:gap-6 min-w-max py-2">
                <div className="flex items-center gap-2 opacity-60 px-3 py-1 bg-black/5 rounded-md border border-border-color/10 cursor-default">
                  {appSettings.autoSave && saveStatus === "saved" ? (
                    <CheckCircle2 size={13} className="text-green-500" />
                  ) : (
                    <AlertCircle size={13} className="text-red-500" />
                  )}
                  <span className="text-[8px] uppercase font-bold tracking-widest hidden sm:inline-block">
                    {appSettings.autoSave
                      ? saveStatus === "saving"
                        ? "Saving"
                        : "Auto-save"
                      : "Manual"}
                  </span>
                </div>

                <div className="w-[1px] h-3 bg-gray-800/40" />

                <div className="relative js-dropdown-container">
                  <Tooltip text="Shortcut: Ctrl + E" position="top">
                    <button
                      onClick={() =>
                        setActiveDropdown(
                          activeDropdown === "view" ? null : "view",
                        )
                      }
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95
                        ${activeDropdown === "view" ? "opacity-100 bg-accent text-panel border-accent" : "opacity-70 hover:opacity-100 border-transparent hover:bg-black/10"}`}
                    >
                      <Type size={14} /> <span>{activeNote.viewMode}</span>{" "}
                      <ChevronDown
                        size={14}
                        className={
                          activeDropdown === "view"
                            ? "rotate-180 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </button>
                  </Tooltip>
                  {isProcessing && (
                    <div className="absolute left-full ml-4 flex items-center gap-2 text-yellow-500 w-max">
                      <Loader2 size={11} className="animate-spin" />
                      <span className="text-[7px] uppercase tracking-[0.2em]">
                        Processing
                      </span>
                    </div>
                  )}
                  {activeDropdown === "view" && (
                    <div className="absolute bottom-full mb-2 left-0 w-36 bg-panel border border-border-color rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                      {["text", "markdown"].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            handleUpdateNote(activeNote.id, {
                              viewMode: mode as "text" | "markdown",
                            });
                            setActiveDropdown(null);
                          }}
                          className={`w-full px-4 py-3 text-left text-[9px] uppercase font-bold tracking-widest transition-colors flex justify-between items-center hover:bg-black/10 hover:text-primary ${activeNote.viewMode === mode ? "bg-primary/5 text-primary" : "text-primary/60"}`}
                        >
                          {mode}{" "}
                          {activeNote.viewMode === mode && (
                            <Check size={14} className="text-accent" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-[1px] h-3 bg-gray-800/40" />

                <div className="flex items-center gap-2">
                  <Tooltip text="Undo (Ctrl+Z)" position="top">
                    <button
                      onClick={handleUndo}
                      disabled={!history[activeNote.id]?.past?.length}
                      className="p-1.5 rounded-lg border border-transparent hover:border-border-color/50 hover:bg-black/10 transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-primary"
                    >
                      <Undo2 size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Redo (Ctrl+Y)" position="top">
                    <button
                      onClick={handleRedo}
                      disabled={!history[activeNote.id]?.future?.length}
                      className="p-1.5 rounded-lg border border-transparent hover:border-border-color/50 hover:bg-black/10 transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-primary"
                    >
                      <Redo2 size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Find & Replace (Ctrl+F)" position="top">
                    <button
                      onClick={() => {
                        if (isFindReplaceOpen) {
                          setIsFindReplaceOpen(false);
                        } else {
                          setIsFindReplaceOpen(true);
                          setIsReplaceExpanded(false);
                          if (
                            activeNote &&
                            activeNote.viewMode === "markdown"
                          ) {
                            handleUpdateNote(activeNote.id, {
                              viewMode: "text",
                            });
                          }
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                        isFindReplaceOpen
                          ? "text-orange-500 bg-orange-500/10 shadow-[0_0_8px_rgba(249,115,22,0.4)] border border-orange-500/30"
                          : "text-muted border border-transparent hover:text-primary hover:bg-black/10 hover:border-border-color/50"
                      }`}
                    >
                      <Search size={14} />
                    </button>
                  </Tooltip>
                </div>

                <div className="w-[1px] h-3 bg-gray-800/40" />

                <div className="relative js-dropdown-container">
                  <Tooltip text="Pick a Tag Color" position="top">
                    <button
                      onClick={() =>
                        setActiveDropdown(
                          activeDropdown === "color" ? null : "color",
                        )
                      }
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] uppercase font-bold tracking-widest transition-all cursor-pointer active:scale-95
                        ${activeDropdown === "color" ? "opacity-100 bg-accent text-panel border-accent" : "opacity-70 hover:opacity-100 border-transparent hover:bg-black/10"}`}
                    >
                      <Palette size={14} style={{ color: activeNote.color }} />{" "}
                      <span className="hidden sm:inline-block">Tag</span>{" "}
                      <ChevronDown
                        size={14}
                        className={
                          activeDropdown === "color"
                            ? "rotate-180 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </button>
                  </Tooltip>
                  {activeDropdown === "color" && (
                    <div className="absolute bottom-full mb-2 left-0 p-3 bg-panel border border-border-color rounded-xl shadow-2xl z-50 flex gap-2 animate-in slide-in-from-bottom-2 duration-200">
                      {COLORS.tagColors.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            handleUpdateNote(activeNote.id, { color: c });
                            setActiveDropdown(null);
                          }}
                          className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform hover:shadow-md"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 text-[8px] uppercase tracking-[0.2em] opacity-80 text-primary min-w-max ml-8">
                <span className="opacity-50 hidden md:inline-block flex-shrink-0">
                  {activeNote.content?.length || 0} chars
                </span>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Tooltip text="Import (Ctrl+O)" position="top">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 hover:text-accent transition-colors flex items-center justify-center rounded-lg border border-transparent hover:border-border-color/50 hover:bg-black/10 cursor-pointer active:scale-95 text-primary"
                    >
                      <FileUp size={16} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Export (Ctrl+Alt+S)" position="top">
                    <button
                      onClick={handleExport}
                      className="p-1.5 hover:text-accent transition-colors flex items-center justify-center rounded-lg border border-transparent hover:border-border-color/50 hover:bg-black/10 cursor-pointer active:scale-95 text-primary"
                    >
                      <Download size={16} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
            </footer>
          )}
        </main>

        {/* SIDEBAR */}
        <aside
          className={`relative flex flex-col bg-panel shrink-0 transition-[width,opacity] duration-500 ease-in-out z-10 ${sidebarMode === "notes" ? "border-l" : "border-l"} ${isFocusMode ? "w-0 opacity-0 overflow-hidden border-transparent" : "opacity-100"}`}
          style={
            !isFocusMode
              ? {
                  width: isSidebarMinimized ? "72px" : sidebarMode === "format" ? "300px" : `${sidebarWidth}px`,
                }
              : {}
          }
        >
          {/* DRAG HANDLE & TOGGLE */}
          {!isFocusMode && (
            <div
              onMouseDown={startResizing}
              className={`absolute left-0 top-0 bottom-0 w-[4px] -translate-x-[2px] z-20 flex items-center justify-center group ${sidebarMode === "format" ? "" : "cursor-col-resize hover:bg-yellow-500/20"}`}
            >
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (sidebarMode === "format") {
                    showToast("Sidebar width is locked in Format Mode", "info");
                  } else {
                    setIsSidebarMinimized(!isSidebarMinimized);
                  }
                }}
                className={`absolute left-0 -translate-x-[12px] w-6 h-12 bg-panel border border-border-color rounded-l-full flex items-center justify-center text-muted hover:text-primary transition-all shadow-sm ${sidebarMode === "format" ? "cursor-not-allowed opacity-30" : "cursor-pointer opacity-50 hover:opacity-100"}`}
              >
                {sidebarMode === "format" ? (
                  <Lock size={12} className="ml-1" />
                ) : isSidebarMinimized ? (
                  <ChevronLeft size={14} className="ml-1" />
                ) : (
                  <ChevronRight size={14} className="ml-1" />
                )}
              </button>
            </div>
          )}

          <div
            className={`flex flex-col h-full overflow-hidden ${isSidebarMinimized ? "items-center py-6" : "p-6 lg:p-8"}`}
          >
            <div
              className={`flex items-center mb-8 w-full gap-2 justify-center ${isSidebarMinimized ? "hidden" : ""}`}
            >
              <div className="flex bg-black/5 p-1 rounded-full w-full relative">
                <div
                  className="absolute top-1 bottom-1 bg-panel shadow-sm rounded-full transition-all duration-300"
                  style={{
                    left: sidebarMode === "notes" ? "0.25rem" : "calc(50% - 0.25rem)",
                    width: "50%",
                  }}
                />
                <button
                  onClick={() => {
                    setSidebarMode("notes");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold z-10 transition-colors ${sidebarMode === "notes" ? "text-primary" : "text-muted hover:text-primary"}`}
                >
                  <ListIcon size={14} /> Notes
                </button>
                <button
                  onClick={() => {
                    if (notes.length === 0) return;
                    setSidebarMode("format");
                    if (isSidebarMinimized) setIsSidebarMinimized(false);
                  }}
                  disabled={notes.length === 0}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold z-10 transition-colors ${sidebarMode === "format" ? "text-primary" : notes.length === 0 ? "text-muted/30 cursor-not-allowed" : "text-muted hover:text-primary"}`}
                >
                  <Wand2 size={14} /> Format
                </button>
              </div>
              <Tooltip text="Create Note" position="bottom" className="shrink-0 flex">
                <button
                  onClick={handleCreateNote}
                  className="p-2.5 rounded-full bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-panel transition-all"
                >
                  <Plus size={16} />
                </button>
              </Tooltip>
            </div>
            {isSidebarMinimized && (
              <div className="flex justify-center mb-8">
                <button
                  onClick={() => {
                    setSidebarMode("notes");
                    handleCreateNote();
                  }}
                  className="p-3 rounded-full bg-accent text-panel hover:scale-105 transition-transform"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}

            <div
              className={`flex flex-col ${isSidebarMinimized ? "gap-4" : "gap-3"} overflow-y-auto custom-scrollbar flex-1 pb-4`}
            >
              {sidebarMode === "notes" ? (
                notes.length > 0 ? (
                  notes.map((note) => {
                    // Smart Title Generation
                    const preview = getNotePreview(note.content);
                    const words = note.content.split(/\s+/).filter(Boolean);
                    const tooltipText =
                      words.slice(0, 80).join(" ") +
                      (words.length > 80 ? "..." : "");

                    return (
                      <React.Fragment key={note.id}>
                        <Tooltip
                          text={tooltipText || "Empty note..."}
                          position="right"
                          className="w-full flex"
                          delay={2000}
                        >
                          <div
                            onClick={() => setActiveNoteId(note.id)}
                            className={`w-full relative group transition-all cursor-pointer ${activeNoteId === note.id ? "opacity-100" : "opacity-30 hover:opacity-60"} ${!isSidebarMinimized ? "pl-4 border-solid border-l-2" : ""}`}
                            style={
                              !isSidebarMinimized
                                ? {
                                    borderLeftColor:
                                      activeNoteId === note.id
                                        ? note.color === COLORS.accent
                                          ? "var(--accent)"
                                          : note.color
                                        : "transparent",
                                  }
                                : {}
                            }
                          >
                            {isSidebarMinimized ? (
                              <div className="relative flex justify-center">
                                <div
                                  className={`p-3 rounded-lg flex items-center justify-center transition-all ${activeNoteId === note.id ? "bg-primary/5 border border-primary/20" : "border border-transparent"}`}
                                >
                                  <FileText
                                    size={20}
                                    className={
                                      note.color === COLORS.accent
                                        ? "text-accent"
                                        : ""
                                    }
                                    style={
                                      note.color !== COLORS.accent
                                        ? { color: note.color }
                                        : {}
                                    }
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold text-primary truncate max-w-[70%]">
                                    {preview.title}
                                  </span>
                                  <Trash2
                                    size={11}
                                    className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletePromptId(note.id);
                                    }}
                                  />
                                </div>
                                <p className="text-[10px] line-clamp-2 leading-relaxed font-light opacity-80">
                                  {preview.snippet || "Empty"}
                                </p>
                              </div>
                            )}
                          </div>
                        </Tooltip>
                      </React.Fragment>
                    );
                  })
                ) : (
                  !isSidebarMinimized && (
                    <div className="flex flex-col items-center justify-center p-6 text-center opacity-50 mt-10">
                      <FileText size={32} className="mb-4 text-muted" />
                      <p className="text-xs mb-4">No notes found.</p>
                      <button onClick={handleCreateNote} className="px-4 py-2 bg-accent text-panel rounded-lg text-xs font-bold uppercase tracking-wider hover:scale-105 transition-transform flex items-center gap-2">
                        <Plus size={14} /> Create Note
                      </button>
                    </div>
                  )
                )
              ) : (
                <div className={`flex flex-col gap-6 ${isSidebarMinimized ? "items-center" : ""}`}>
                  {!isSidebarMinimized && (
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-2">Text Formatting</div>
                  )}
                  {/* Inline format row */}
                  <div className={`flex bg-panel border-y border-border-color shadow-sm ${isSidebarMinimized ? "flex-col w-min border-x rounded-xl" : "w-full -mx-6 px-6"}`}>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("**", "**", "Bold"); }} className={`flex-1 ${isSidebarMinimized ? "p-3 border-b border-border-color last:border-0" : "py-3"} hover:bg-black/5 text-primary transition-colors flex items-center justify-center`} title="Bold"><Bold size={16} /></button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("_", "_", "Italic"); }} className={`flex-1 ${isSidebarMinimized ? "p-3 border-b border-border-color last:border-0" : "py-3"} hover:bg-black/5 text-primary transition-colors flex items-center justify-center`} title="Italic"><Italic size={16} /></button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("~~", "~~", "Strikethrough"); }} className={`flex-1 ${isSidebarMinimized ? "p-3 border-b border-border-color last:border-0" : "py-3"} hover:bg-black/5 text-primary transition-colors flex items-center justify-center`} title="Strikethrough"><Strikethrough size={16} /></button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("`", "`", "code"); }} className={`flex-1 ${isSidebarMinimized ? "p-3 border-b border-border-color last:border-0" : "py-3"} hover:bg-black/5 text-primary transition-colors flex items-center justify-center`} title="Inline Code"><Code size={16} /></button>
                  </div>

                  {!isSidebarMinimized && (
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mt-2 mb-2">Blocks & Layout</div>
                  )}
                  <div className="flex flex-col gap-2 w-full">
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("# ", "", "Heading 1"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Heading 1">
                      <Heading1 size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Heading 1</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("## ", "", "Heading 2"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Heading 2">
                      <Heading2 size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Heading 2</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("\n> ", "", "Quote"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Blockquote">
                      <Quote size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Blockquote</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("\n- ", "", "List item"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Bulleted List">
                      <ListIcon size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Bulleted List</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("\n- [ ] ", "", "Task"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Checkbox List">
                      <ListIcon size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Checkbox List</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("\n- [x] ", "", "Done Task"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Checked Task">
                      <CheckSquare size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Checked Task</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("\n```\n", "\n```\n", "code block"); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Code Block">
                      <Code size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Code Block</span>}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat("\n| Header | Title |\n| ------------- | ------------- |\n| Cell | Cell |\n", ""); }} className={`w-full flex items-center gap-3 p-3 bg-panel border-border-color border rounded-xl hover:bg-black/5 transition-colors group ${isSidebarMinimized ? "justify-center" : ""}`} title="Table">
                      <Table size={18} className="text-muted group-hover:text-primary transition-colors" />
                      {!isSidebarMinimized && <span className="text-sm font-medium">Table</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        appSettings={appSettings}
        setAppSettings={setAppSettings}
      />

      {/* Delete Prompt Dialog */}
      {deletePromptId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="bg-panel border border-border-color rounded-2xl p-8 max-w-sm w-[90%] shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2 text-primary">
              Delete Note?
            </h3>
            <p className="text-sm opacity-70 mb-6 font-mono text-primary">
              This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                autoFocus
                className="flex-1 py-3 rounded-xl border border-border-color hover:bg-black/10 font-bold tracking-wider text-primary"
                onClick={() => setDeletePromptId(null)}
              >
                NO
              </button>
              <button
                className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold tracking-wider transition-colors"
                onClick={(e) => {
                  handleDeleteNote(e as any, deletePromptId);
                  setDeletePromptId(null);
                }}
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
