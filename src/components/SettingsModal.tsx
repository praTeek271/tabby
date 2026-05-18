import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { AppSettings } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  appSettings,
  setAppSettings,
}: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<"general" | "shortcuts" | "about">(
    "general",
  );
  const [showPrivacy, setShowPrivacy] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Nested Privacy Modal */}
      {showPrivacy && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowPrivacy(false);
          }}
        >
          <div
            className="w-[90%] max-w-lg bg-panel border border-border-color rounded-2xl p-8 relative shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPrivacy(false)}
              className="absolute top-6 right-6 opacity-60 hover:opacity-100 hover:scale-110 active:scale-95 transition-all text-primary/90"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-mono text-primary mb-4 border-b border-border-color pb-4">
              Privacy Policy
            </h3>
            <div className="space-y-4 text-sm text-primary/70 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-4">
              <p>
                <strong>1. Data Storage:</strong> Tabby primarily stores your
                notes locally in your browser's LocalStorage. If you connect
                your Google Drive account, your notes are synced securely to a
                hidden AppData folder in your personal Drive.
              </p>
              <p>
                <strong>2. Third-Party Access:</strong> We do not have access to
                your Google Drive files outside of the specific folder created
                by Tabby. Your notes are private to you.
              </p>
              <p>
                <strong>3. Analytics:</strong> We may collect anonymous usage
                data to improve the application. No personal information or note
                content is ever transmitted to our servers.
              </p>
              <p>
                <strong>4. Local Only Usage:</strong> You are welcome to use
                Tabby entirely offline without ever connecting an account. In
                this mode, no data leaves your device.
              </p>
            </div>
            <button
              className="mt-8 px-6 py-2 bg-accent text-panel font-bold rounded-lg w-full hover:opacity-90 transition-opacity"
              onClick={() => setShowPrivacy(false)}
            >
              Understand & Close
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Modal */}
      <div
        className="w-[95%] sm:w-[90%] max-w-4xl h-[85vh] sm:h-[75vh] rounded-2xl border border-border-color overflow-hidden relative animate-in fade-in zoom-in duration-200 shadow-2xl cursor-default flex flex-col sm:flex-row bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 sm:top-8 sm:right-8 opacity-60 hover:opacity-100 hover:scale-110 active:scale-95 transition-all text-primary/90 z-20 bg-panel/50 p-1 rounded-lg backdrop-blur-sm"
        >
          <X size={24} />
        </button>

        {/* Left Sidebar */}
        <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-border-color bg-main/50 p-6 flex flex-col shrink-0">
          <h2 className="text-2xl font-mono mb-8 tracking-tight text-primary uppercase">
            Settings
          </h2>
          <nav className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0">
            {["general", "shortcuts", "about"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`text-left px-4 py-3 rounded-xl font-mono text-xs uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeTab === tab ? "bg-accent text-panel font-bold shadow-md transform scale-[1.02]" : "text-primary/60 hover:text-primary hover:bg-black/10"}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 p-8 sm:p-12 overflow-y-auto custom-scrollbar bg-panel">
          {activeTab === "general" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.4em] opacity-40 mb-6 font-mono text-accent">
                  Preferences
                </h3>
                <div className="space-y-4">
                  <div
                    className="flex justify-between items-center group cursor-pointer p-5 rounded-2xl border border-border-color/50 hover:bg-black/5 hover:border-accent/30 transition-all"
                    onClick={() =>
                      setAppSettings((s) => ({ ...s, autoSave: !s.autoSave }))
                    }
                  >
                    <div>
                      <p className="text-sm font-medium text-primary transition-colors">
                        Auto-save Notes
                      </p>
                      <p className="text-[10px] font-mono opacity-50 mt-1 text-primary/70">
                        Changes sync automatically
                      </p>
                    </div>
                    <button
                      className={`w-12 h-6 rounded-full transition-all relative cursor-pointer active:scale-95 shadow-inner`}
                      style={{
                        backgroundColor: appSettings.autoSave
                          ? "var(--accent)"
                          : "var(--border)",
                      }}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-panel shadow-sm transition-all ${appSettings.autoSave ? "left-7" : "left-1"}`}
                      />
                    </button>
                  </div>

                  <div className="flex justify-between items-center p-5 rounded-2xl border border-border-color/50 hover:bg-black/5 hover:border-accent/30 transition-all">
                    <div>
                      <p className="text-sm font-medium text-primary">
                        Default Font Size
                      </p>
                      <p className="text-[10px] font-mono opacity-50 mt-1 text-primary/70">
                        Editor text size
                      </p>
                    </div>
                    <select
                      value={appSettings.fontSize}
                      onChange={(e) =>
                        setAppSettings((s) => ({
                          ...s,
                          fontSize: e.target.value,
                        }))
                      }
                      className="border border-border-color bg-main rounded-lg px-4 py-2 outline-none text-xs font-mono appearance-none text-center cursor-pointer hover:border-accent/50 focus:border-accent transition-all min-w-[100px] text-primary"
                    >
                      <option value="14px">Small</option>
                      <option value="16px">Regular</option>
                      <option value="18px">Medium</option>
                      <option value="20px">Large</option>
                    </select>
                  </div>

                  <div className="flex justify-between items-center p-5 rounded-2xl border border-border-color/50 hover:bg-black/5 hover:border-accent/30 transition-all">
                    <div>
                      <p className="text-sm font-medium text-primary">
                        Theme Color
                      </p>
                      <p className="text-[10px] font-mono opacity-50 mt-1 text-primary/70">
                        Application appearance
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={appSettings.theme}
                        onChange={(e) => {
                          const newTheme = e.target.value;
                          setAppSettings((s) => ({ ...s, theme: newTheme }));
                        }}
                        className="border border-border-color bg-main rounded-lg px-4 py-2 outline-none text-xs font-mono appearance-none text-center cursor-pointer hover:border-accent/50 focus:border-accent transition-all min-w-[120px] text-primary"
                      >
                        <option value="midnight">Midnight Neon</option>
                        <option value="paper">Paper White</option>
                        <option value="sepia">Sepia Ink</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-[10px] uppercase tracking-[0.4em] opacity-40 font-mono text-accent">
                Keyboard Shortcuts
              </h3>

              <div className="grid gap-3">
                {[
                  { label: "New Note", keys: ["Ctrl", "T"] },
                  { label: "Toggle Markdown / Text", keys: ["Ctrl", "E"] },
                  { label: "Find", keys: ["Ctrl", "F"] },
                  { label: "Replace", keys: ["Ctrl", "H"] },
                  { label: "Import Note", keys: ["Ctrl", "O"] },
                  { label: "Export Note", keys: ["Ctrl", "Alt", "S"] },
                  { label: "Delete Active Note", keys: ["Ctrl", "Del"] },
                  { label: "Undo", keys: ["Ctrl", "Z"] },
                  {
                    label: "Redo",
                    keys: ["Ctrl", "Y", "or", "Ctrl", "Shift", "Z"],
                  },
                  { label: "Toggle Focus Mode", keys: ["Esc"] },
                ].map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-4 rounded-xl border border-border-color/30 bg-main/30"
                  >
                    <span className="text-sm text-primary/80">
                      {shortcut.label}
                    </span>
                    <div className="flex gap-2">
                      {shortcut.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="px-2.5 py-1 bg-black/20 border border-border-color/60 rounded-md text-[10px] font-mono text-primary/90 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-mono text-primary/40 text-center mt-8">
                Shortcut editing is coming soon.
              </p>
            </div>
          )}

          {activeTab === "about" && (
            <div className="flex flex-col items-center justify-center text-center h-full animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="relative group">
                <img
                  src="/icon.png"
                  alt="Tabby Logo"
                  className="w-20 h-20 rounded-2xl shadow-xl shadow-accent/20 mb-6 group-hover:-rotate-6 transition-transform duration-300 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove(
                      "hidden",
                    );
                  }}
                />
                <div className="hidden w-20 h-20 rounded-2xl bg-accent text-panel flex items-center justify-center text-3xl font-black italic tracking-tighter shadow-xl shadow-accent/20 mb-6 transform -rotate-6">
                  TAB
                </div>
              </div>
              <h2 className="text-3xl font-black italic tracking-tighter text-accent mb-2">
                TABBY
              </h2>
              <p className="text-xs font-mono text-primary/50 mb-8 uppercase tracking-widest">
                Version 1.0.0
              </p>

              <div className="space-y-4 w-full max-w-sm">
                <div className="p-4 rounded-xl border border-border-color bg-main/50 text-sm text-primary">
                  <p className="opacity-70 mb-1">Created by</p>
                  <p className="font-semibold">Prateek Kumar Singh</p>
                </div>

                <a
                  href="#"
                  className="flex items-center justify-center gap-3 p-4 rounded-xl bg-primary text-panel font-medium hover:opacity-90 transition-opacity"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                  GitHub Repository
                </a>

                <button
                  onClick={() => setShowPrivacy(true)}
                  className="w-full p-4 rounded-xl border border-border-color hover:bg-black/10 text-primary font-medium transition-colors"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
