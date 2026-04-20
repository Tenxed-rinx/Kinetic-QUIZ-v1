import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { Rocket, Trash2, Copy, Plus, Check, X, Clock, Bold, Italic, Sigma, ImagePlus, ImageIcon, Languages, FileSpreadsheet, AlertCircle } from "lucide-react";
import { read, utils } from 'xlsx';
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useQuiz, Quiz } from "@/src/context/QuizContext";
import AIChatAssistant from "@/src/components/AIChatAssistant";

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Helper Rich Text Editor component
function RichEditor({ id, value, onChange }: { id: string, value: string, onChange: (val: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div
      id={id}
      ref={editorRef}
      contentEditable
      onInput={handleInput}
      onBlur={handleInput}
      className="w-full bg-surface-container-low border-2 border-outline-variant/10 rounded-xl p-6 text-lg font-medium focus:ring-2 focus:ring-primary-container outline-none min-h-[160px] transition-all prose prose-sm max-w-none text-on-surface"
      style={{ whiteSpace: 'pre-wrap' }}
    />
  );
}

export default function QuizEditor() {
  const { 
    createQuiz, 
    saveDraft, 
    deleteDraft,
    clearCurrentDraft,
    draftQuiz, 
    drafts,
    quizzes, 
    quizEnded, 
    closeQuizEndedMessage 
  } = useQuiz();
  const [title, setTitle] = useState("");
  const activeQuiz = quizzes.find(q => q.isActive);
  const [questions, setQuestions] = useState<any[]>([]);
  const totalQuestions = questions.length;
  const [drawCount, setDrawCount] = useState(0);
  const [defaultTimer, setDefaultTimer] = useState(43);
  const [hasManuallySetDrawCount, setHasManuallySetDrawCount] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Validation logic
  const getValidationIssues = useCallback(() => {
    const issues: string[] = [];
    if (!title || !title.trim()) issues.push("Quiz title is required.");
    
    if (!questions || questions.length === 0) {
      issues.push("At least one question is required.");
    } else {
      if (drawCount <= 0) issues.push("Draw count must be at least 1.");
      if (drawCount > questions.length) issues.push("Draw count cannot exceed total questions.");
      
      questions.forEach((q, i) => {
        const qNum = i + 1;
        
        // 1. Content Check
        const hasText = q.text && q.text.trim().length > 0;
        const hasImage = !!q.image;
        if (!hasText && !hasImage) {
          issues.push(`Question #${qNum} text or image is missing.`);
        }
        
        // 2. Question Types Check
        if (q.type === "Paragraph") {
          // No options or correct answers required for Paragraph
          return;
        }

        // SCORABLE QUESTIONS (Multiple Choice, Multiple Correct, True/False)
        const isMultipleCorrect = q.type === "Multiple Correct" || q.type === "MSQ";
        const isTrueFalse = q.type === "True/False";
        
        // Options requirement
        if (!isTrueFalse) {
          // Standard Multiple Choice / Multiple Correct needs 4 options
          const opts = q.options || {};
          const labelA = String(opts.A || "").trim();
          const labelB = String(opts.B || "").trim();
          const labelC = String(opts.C || "").trim();
          const labelD = String(opts.D || "").trim();
          
          if (!labelA || !labelB || !labelC || !labelD) {
            issues.push(`Question #${qNum} needs all 4 options filled.`);
          }
        }
        
        // Correct Answer requirement
        let hasCorrectValue = false;
        if (isMultipleCorrect) {
          hasCorrectValue = Array.isArray(q.correctOption) && q.correctOption.length > 0;
        } else {
          // Single Correct
          const val = q.correctOption;
          hasCorrectValue = val !== null && val !== undefined && String(val).trim() !== "";
        }
        
        if (!hasCorrectValue) {
          issues.push(`Question #${qNum} needs a correct answer selected.`);
        }
      });
    }
    
    return issues;
  }, [title, questions, drawCount]);

  const validationIssues = getValidationIssues();
  const hasValidationErrors = validationIssues.length > 0;

  const [allowedRollPatterns, setAllowedRollPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (draftQuiz) {
      if (draftQuiz.title) setTitle(draftQuiz.title);
      if (draftQuiz.drawCount) {
        setDrawCount(draftQuiz.drawCount);
        setHasManuallySetDrawCount(true);
      }
      if (draftQuiz.allowedRollPatterns) {
        setAllowedRollPatterns(draftQuiz.allowedRollPatterns);
      }
      if (draftQuiz.questions) {
        setQuestions(draftQuiz.questions.map(q => ({
          id: q.id,
          text: q.text,
          type: q.type || "Multiple Choice",
          timer: q.timer || 45,
          correctOption: q.correctOption || null,
          options: {
            A: q.options.A || "",
            B: q.options.B || "",
            C: q.options.C || "",
            D: q.options.D || "",
          }
        })));
      }
    }
  }, [draftQuiz]);

  const handleReset = () => {
    setTitle("");
    setQuestions([]);
    setDrawCount(0);
    setAllowedRollPatterns([]);
    setHasManuallySetDrawCount(false);
    clearCurrentDraft();
    setValidationError(null);
  };

  const handleLoadDraft = (draft: Partial<Quiz>) => {
    setTitle(draft.title || "");
    setDrawCount(draft.drawCount || 0);
    setAllowedRollPatterns(draft.allowedRollPatterns || []);
    if (draft.customTimer) {
      setDefaultTimer(draft.customTimer);
    }
    if (draft.questions) {
      setQuestions(draft.questions.map(q => ({
        id: q.id,
        text: q.text,
        image: q.image,
        type: q.type || "Multiple Choice",
        timer: q.timer || draft.customTimer || 45,
        options: q.options || { A: "", B: "", C: "", D: "" },
        correctOption: q.correctOption || null
      })));
      setHasManuallySetDrawCount(true);
    }
  };

  useEffect(() => {
    if (!hasManuallySetDrawCount) {
      setDrawCount(questions.length);
    } else if (drawCount > questions.length) {
      setDrawCount(questions.length);
    }
  }, [questions.length, hasManuallySetDrawCount, drawCount]);

  const handleSaveDraft = () => {
    const issues = getValidationIssues();
    if (issues.length > 0) {
      if (!confirm(`Warning: Your quiz has validation issues (e.g., ${issues[0]}). Saving as a draft is okay, but you won't be able to start the quiz until these are fixed. Save anyway?`)) {
        return;
      }
    }
    
    saveDraft({
      title,
      totalQuestions,
      drawCount,
      customTimer: defaultTimer,
      questions: questions.map(q => ({
        id: q.id,
        text: q.text,
        image: q.image,
        type: q.type || "Multiple Choice",
        timer: q.timer || defaultTimer,
        options: q.options,
        correctOption: q.correctOption || ""
      })),
      allowedRollPatterns
    });
    alert("Draft saved successfully!");
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { 
      id: Date.now().toString(), 
      text: "", 
      image: null,
      correctOption: null, 
      type: "Multiple Choice", 
      timer: defaultTimer,
      options: { A: "", B: "", C: "", D: "" }
    }]);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
      setValidationError("Invalid file type. Please upload a .xlsx or .csv file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setValidationError("The uploaded file is empty.");
          setIsImporting(false);
          return;
        }

        // Validate headers
        const requiredHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
        const headers = Object.keys(data[0]);
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setValidationError("Incorrect template format. Required headers: " + requiredHeaders.join(', ') + ", Timer (optional)");
          setIsImporting(false);
          return;
        }

        const newQuestions = data
          .filter(row => row['Question']?.toString().trim()) // Skip rows without a question
          .map((row, idx) => {
            const rawCorrect = row['Correct Answer']?.toString().toUpperCase().trim() || "";
            let correctValue: any = null;

            const options = {
              A: row['Option A']?.toString().trim() || "null",
              B: row['Option B']?.toString().trim() || "null",
              C: row['Option C']?.toString().trim() || "null",
              D: row['Option D']?.toString().trim() || "null",
            };

            // 1. Exact match label (A, B, C, D)
            if (['A', 'B', 'C', 'D'].includes(rawCorrect)) {
              correctValue = rawCorrect;
            } 
            // 2. Index match (1 -> A, 2 -> B, etc.)
            else if (['1', '2', '3', '4'].includes(rawCorrect)) {
              const label = ['A', 'B', 'C', 'D'][parseInt(rawCorrect) - 1];
              correctValue = label;
            }
            // 3. "Option A" or "Opt A" match
            else if (rawCorrect.includes('OPTION ') || rawCorrect.includes('OPT ')) {
              const char = rawCorrect.slice(-1);
              if (['A', 'B', 'C', 'D'].includes(char)) {
                correctValue = char;
              }
            }
            // 4. Text match
            else {
              const foundLabel = Object.entries(options).find(([_, text]) => text && text !== "null" && text.toUpperCase() === rawCorrect.toUpperCase())?.[0];
              if (foundLabel) {
                correctValue = foundLabel;
              }
            }

            // Fallback: Randomly select if still null
            if (!correctValue) {
              const labels = ['A', 'B', 'C', 'D'];
              correctValue = labels[Math.floor(Math.random() * labels.length)];
            }

            return {
              id: `excel-${Date.now()}-${idx}`,
              text: row['Question'] || "",
              image: null,
              type: "Multiple Choice",
              timer: row['Timer'] ? parseInt(row['Timer']) : 30,
              correctOption: correctValue,
              options
            };
          });

        setQuestions(prev => [...prev, ...newQuestions]);
        setValidationError(null);
        alert(`Successfully imported ${newQuestions.length} questions!`);
      } catch (err) {
        console.error("Excel import error:", err);
        setValidationError("Failed to parse the file. Please check the integrity of your Excel/CSV.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleRemoveQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const handleUpdateQuestion = (id: string, updates: Partial<typeof questions[0] & { type: string, timer: number }>) => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        const updated = { ...q, ...updates };
        
        // Handle type changes
        if (updates.type) {
          if (updates.type === "True/False") {
            updated.options = { A: "True", B: "False" };
            updated.correctOption = null;
          } else if (updates.type === "Multiple Correct") {
            updated.correctOption = [];
            updated.options = { A: "", B: "", C: "", D: "" };
          } else if (updates.type === "Paragraph") {
            updated.options = {};
            updated.correctOption = "MANUAL_CHECK";
          } else {
            updated.options = { A: "", B: "", C: "", D: "" };
            updated.correctOption = null;
          }
        }
        
        return updated;
      }
      return q;
    }));
  };

  const handleSave = async () => {
    const issues = getValidationIssues();
    if (issues.length > 0) {
      setValidationError(`Cannot save quiz: ${issues[0]} (and ${issues.length - 1} other issues)`);
      return;
    }

    if (activeQuiz) {
      setValidationError("You already have an active quiz session. Please end it from the dashboard before creating a new one.");
      return;
    }

    setValidationError(null);
    setIsSaving(true);

    // Generate a random 6-digit room code: 123-456
    const digits = Math.floor(100000 + Math.random() * 900000).toString();
    const roomCode = `${digits.substring(0, 3)}-${digits.substring(3)}`;
    
    try {
      console.log("Calling createQuiz with roomCode:", roomCode);
      await createQuiz({
        title,
        totalQuestions,
        drawCount,
        roomCode,
        customTimer: defaultTimer,
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          image: q.image,
          type: q.type || "Multiple Choice",
          timer: q.timer,
          options: q.options,
          correctOption: q.correctOption || ""
        })),
        allowedRollPatterns,
        isActive: true,
        status: 'waiting'
      });
      
      console.log("Quiz created successfully");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Failed to create quiz:", error);
      setValidationError(error.message || "An error occurred while creating the quiz. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen pb-24">
      <TopAppBar />
      
      <main className="max-w-5xl mx-auto px-6 pt-8">
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="text-sm font-semibold uppercase tracking-widest text-primary mb-2 block font-label">Assessment Builder</span>
              <h1 className="text-5xl font-extrabold font-headline tracking-tighter text-on-surface">Create New Quiz</h1>
            </div>
            <div className="flex gap-3">
              {activeQuiz && (
                <div className="hidden lg:flex items-center px-4 py-2 bg-error/10 text-error text-xs font-bold rounded-lg border border-error/20 max-w-xs">
                  An active quiz is already running. End it to create a new one.
                </div>
              )}
              <button 
                onClick={handleReset}
                className="px-6 py-3 rounded-xl border border-error/20 text-error font-semibold hover:bg-error/5 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Reset
              </button>
              <button 
                onClick={handleSaveDraft}
                className="px-6 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-semibold hover:bg-surface-container-low transition-colors"
              >
                Save Draft
              </button>
              <button 
                onClick={handleSave}
                disabled={!!activeQuiz || isSaving || hasValidationErrors}
                className={cn(
                  "px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95",
                  (!!activeQuiz || isSaving || hasValidationErrors)
                    ? "bg-outline-variant/20 text-on-surface-variant/40 cursor-not-allowed grayscale"
                    : "bg-gradient-to-r from-primary to-primary-dim text-white shadow-primary/20 hover:scale-[1.02]"
                )}
              >
                <span>{isSaving ? "Saving..." : "Generate Room Code & Save"}</span>
                {hasValidationErrors ? (
                  <Check className="w-5 h-5 opacity-20" /> // Using Check as a dummy icon when grayed
                ) : (
                  <Rocket className={cn("w-5 h-5", isSaving && "animate-bounce")} />
                )}
              </button>
            </div>
          </div>
        </header>

        {hasValidationErrors && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-error/10 border-2 border-error/20 rounded-2xl text-error relative"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 font-bold" />
              <span className="font-black uppercase tracking-widest text-xs">Required Setup Incomplete</span>
            </div>
            <ul className="text-xs font-bold space-y-1 list-disc list-inside opacity-80">
              {validationIssues.slice(0, 3).map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
              {validationIssues.length > 3 && <li>...and {validationIssues.length - 3} more issues</li>}
            </ul>
          </motion.div>
        )}

        {validationError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-error/10 border border-error/20 rounded-xl text-error font-bold text-center relative flex items-center justify-center"
          >
            <span>{validationError}</span>
            <button 
              onClick={() => setValidationError(null)}
              className="absolute right-4 p-1 hover:bg-error/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {quizEnded && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 font-bold text-center relative flex items-center justify-center"
            >
              <span>u ended the quiz</span>
              <button 
                onClick={closeQuizEndedMessage}
                className="absolute right-4 p-1 hover:bg-emerald-500/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

              {/* Multiple Drafts Section */}
        {drafts.length > 0 && (
          <section className="bg-surface-container-low p-8 rounded-2xl mb-12 tonal-lift">
            <div className="flex items-center justify-between mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-label">Saved Drafts ({drafts.length})</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((d, i) => (
                <div 
                  key={`${d.title}-${i}`}
                  className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 hover:border-primary/50 cursor-pointer group transition-all"
                  onClick={() => handleLoadDraft(d)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-headline font-bold text-on-surface truncate pr-2">{d.title}</h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDraft(d.title!);
                      }}
                      className="p-1 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    <span>{d.questions?.length || 0} Questions</span>
                    <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
                    <span>{d.drawCount || 0} Draw</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quiz Global Settings */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="md:col-span-2 bg-surface-container-low p-8 rounded-2xl tonal-lift">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 font-label">Quiz Title</label>
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-2xl font-bold font-headline placeholder:text-outline-variant transition-all pb-2" 
              placeholder="e.g., HCI" 
              type="text" 
            />
          </div>
          
          <div className="bg-surface-container-low p-8 rounded-2xl tonal-lift flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4 font-label">Configuration</label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Questions</span>
                  <div className="w-16 bg-surface-container-lowest py-2 rounded-lg text-center font-bold text-primary border border-outline-variant/10">
                    {totalQuestions}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Draw for Student</span>
                  <input 
                    value={drawCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHasManuallySetDrawCount(true);
                      if (val <= totalQuestions) {
                        setDrawCount(val);
                      } else {
                        setDrawCount(totalQuestions);
                      }
                    }}
                    className="w-16 bg-surface-container-lowest border-0 rounded-lg text-center font-bold text-primary focus:ring-2 focus:ring-primary-container" 
                    type="number" 
                    min="1"
                    max={totalQuestions}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Default Timer (s)</span>
                    <div className="flex items-center gap-2">
                      <input 
                        value={defaultTimer}
                        onChange={(e) => setDefaultTimer(Number(e.target.value))}
                        className="w-16 bg-surface-container-lowest border-0 rounded-lg text-center font-bold text-secondary focus:ring-2 focus:ring-secondary-container" 
                        type="number" 
                        min="5"
                      />
                      <button 
                        onClick={() => {
                          setQuestions(questions.map(q => ({ ...q, timer: defaultTimer })));
                        }}
                        className="bg-secondary/10 text-secondary hover:bg-secondary/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        title="Apply this timer to all existing questions"
                      >
                        <Clock className="w-3 h-3" />
                        Apply All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant/10 font-bold uppercase tracking-widest text-[9px]">
              <div className="flex flex-col gap-2">
                <p className="text-on-surface-variant leading-tight opacity-70">Randomizes question delivery per student session.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Roll Number Restrictions */}
        <section className="bg-surface-container-low p-8 rounded-2xl tonal-lift mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1 font-label">Roll Number Restrictions</label>
              <p className="text-[10px] text-on-surface-variant">Only students matching these patterns can join. Format: <code className="bg-surface-container-highest px-1 rounded">YEAR-CODE-START-END</code></p>
            </div>
            <div className="flex gap-2">
              <input 
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. 2023-IMG-001-061"
                className="bg-surface-container-lowest border-0 rounded-lg text-sm px-4 py-2 focus:ring-2 focus:ring-primary-container w-48"
              />
              <button 
                onClick={() => {
                  if (!newPattern.trim()) return;
                  const parts = newPattern.split('-');
                  if (parts.length !== 4) {
                    alert("Invalid format. Use YEAR-CODE-START-END (e.g. 2023-IMG-001-061)");
                    return;
                  }
                  setAllowedRollPatterns([...allowedRollPatterns, newPattern.trim().toUpperCase()]);
                  setNewPattern("");
                }}
                className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dim transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {allowedRollPatterns.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No restrictions set. All roll numbers are allowed.</p>
            ) : (
              allowedRollPatterns.map((pattern, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-bold border border-primary/20">
                  <span>{pattern}</span>
                  <button 
                    onClick={() => setAllowedRollPatterns(allowedRollPatterns.filter((_, i) => i !== idx))}
                    className="hover:text-error transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Question Builder Stack */}
        <section className="space-y-8">
          {questions.map((q, index) => (
            <motion.div 
              key={q.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-surface-container-lowest p-8 rounded-2xl border-l-8 border-primary shadow-sm group"
            >
              <div className="absolute -right-3 top-8 flex flex-col gap-2">
                <button 
                  onClick={() => handleRemoveQuestion(q.id)}
                  className="p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-full shadow-sm hover:text-error transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-full shadow-sm hover:text-primary transition-colors">
                  <Copy className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-48 flex-shrink-0">
                  <div className="mb-6">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Question {index} Type</label>
                    <select 
                      value={q.type || "Multiple Choice"}
                      onChange={(e) => handleUpdateQuestion(q.id, { type: e.target.value })}
                      className="w-full bg-surface-container-low border-0 rounded-xl text-xs font-bold py-3 focus:ring-primary"
                    >
                      <option>Multiple Choice</option>
                      <option>True/False</option>
                      <option>Multiple Correct</option>
                      <option>Paragraph</option>
                    </select>
                  </div>
                  <div className="glass-timer p-4 rounded-2xl text-center">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Timer</label>
                    <div className="flex items-center justify-center gap-1">
                      <input 
                        className="w-12 bg-transparent border-0 text-center text-xl font-bold p-0 focus:ring-0" 
                        type="number" 
                        value={q.timer} 
                        onChange={(e) => handleUpdateQuestion(q.id, { timer: Number(e.target.value) })}
                      />
                      <span className="text-sm font-bold text-on-surface-variant">s</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-tertiary w-3/4 h-full"></div>
                    </div>
                  </div>
                </div>

                <div className="flex-grow space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-label">Question Text</label>
                        <div className="flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/10 shadow-sm relative group/math">
                          <button 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const el = document.getElementById(`q-text-${q.id}`);
                              if (el) {
                                el.focus();
                                document.execCommand('bold', false);
                                handleUpdateQuestion(q.id, { text: el.innerHTML });
                              }
                            }}
                            className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors" 
                            title="Bold"
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const el = document.getElementById(`q-text-${q.id}`);
                              if (el) {
                                el.focus();
                                document.execCommand('italic', false);
                                handleUpdateQuestion(q.id, { text: el.innerHTML });
                              }
                            }}
                            className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors" 
                            title="Italic"
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-px h-4 bg-outline-variant/30 mx-1"></div>
                          
                          <div className="relative inline-block">
                            <button 
                              onMouseDown={(e) => e.preventDefault()}
                              className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors flex items-center gap-0.5" 
                              title="Insert Math Symbols"
                            >
                              <Sigma className="w-3.5 h-3.5" />
                              <Plus className="w-2 h-2 opacity-30" />
                            </button>
                            
                            <div className="absolute top-full left-0 mt-2 p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-50 opacity-0 invisible group-hover/math:opacity-100 group-hover/math:visible transition-all w-48 pointer-events-none group-hover/math:pointer-events-auto">
                              <p className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Extended Symbols</p>
                              <div className="grid grid-cols-4 gap-1">
                                {[
                                  { s: 'α', l: '\\alpha' }, { s: 'β', l: '\\beta' }, { s: 'γ', l: '\\gamma' }, { s: 'π', l: '\\pi' },
                                  { s: '√', l: '\\sqrt{}' }, { s: 'Σ', l: '\\sum' }, { s: '∫', l: '\\int' }, { s: 'θ', l: '\\theta' },
                                  { s: '±', l: '\\pm' }, { s: '≠', l: '\\neq' }, { s: '≤', l: '\\leq' }, { s: '≥', l: '\\geq' },
                                  { s: '∞', l: '\\infty' }, { s: 'Δ', l: '\\Delta' }, { s: 'λ', l: '\\lambda' }, { s: 'Ω', l: '\\Omega' }
                                ].map((item) => (
                                  <button 
                                    key={item.s}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const el = document.getElementById(`q-text-${q.id}`);
                                      if (el) {
                                        el.focus();
                                        const isBlock = item.l.includes('\\') && !item.s.match(/[α-ω]/i);
                                        const insert = isBlock ? ` $${item.l}$ ` : item.s;
                                        document.execCommand('insertText', false, insert);
                                        handleUpdateQuestion(q.id, { text: el.innerHTML });
                                      }
                                    }}
                                    className="p-1.5 hover:bg-primary/10 hover:text-primary rounded text-xs transition-colors font-bold"
                                    title={item.l}
                                  >
                                    {item.s}
                                  </button>
                                ))}
                              </div>
                              <button 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const el = document.getElementById(`q-text-${q.id}`);
                                  if (el) {
                                    el.focus();
                                    const insert = "\n$$ E=mc^2 $$\n";
                                    document.execCommand('insertText', false, insert);
                                    handleUpdateQuestion(q.id, { text: el.innerHTML });
                                  }
                                }}
                                className="w-full mt-2 py-1 bg-surface-container-low hover:bg-surface-container-high rounded text-[8px] font-bold uppercase tracking-widest transition-colors"
                              >
                                Insert Equation Block
                              </button>
                            </div>
                          </div>
                        <div className="w-px h-4 bg-outline-variant/30 mx-1"></div>
                        <div className="relative group/upload">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 800 * 1024) {
                                  alert("Image size too large for database. Please keep it under 800KB.");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  handleUpdateQuestion(q.id, { image: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <button className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors">
                            <ImagePlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full">
                      <RichEditor 
                        id={`q-text-${q.id}`}
                        value={q.text}
                        onChange={(val) => handleUpdateQuestion(q.id, { text: val })}
                      />
                      {q.image && (
                        <div className="relative mt-4 group/img max-w-md mx-auto">
                          <img src={q.image} alt="Question" className="max-w-full rounded-xl border border-outline-variant/20 shadow-sm" />
                          <button 
                            onClick={() => handleUpdateQuestion(q.id, { image: undefined })}
                            className="absolute top-2 right-2 p-1.5 bg-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.type === "Paragraph" ? (
                      <div className="md:col-span-2 bg-surface-container-low/30 p-6 rounded-xl border border-outline-variant/10 italic text-on-surface-variant text-sm">
                        Paragraph questions do not have predefined options. Students will provide a written response (max 50 words) which requires manual grading.
                      </div>
                    ) : (
                      (q.type === "True/False" ? ['A', 'B'] : ['A', 'B', 'C', 'D']).map((label) => {
                        const isCorrect = Array.isArray(q.correctOption) 
                          ? q.correctOption.includes(label) 
                          : q.correctOption === label;

                        const toggleCorrect = () => {
                          if (q.type === "Multiple Correct") {
                            const current = Array.isArray(q.correctOption) ? q.correctOption : [];
                            const next = current.includes(label) 
                              ? current.filter(l => l !== label) 
                              : [...current, label];
                            handleUpdateQuestion(q.id, { correctOption: next });
                          } else {
                            handleUpdateQuestion(q.id, { correctOption: label });
                          }
                        };

                        return (
                          <div 
                            key={label}
                            onClick={toggleCorrect}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer",
                              isCorrect ? "border-2 border-secondary/50 bg-secondary/5" : "border-outline-variant/10 bg-surface-container-low/30 hover:border-primary/30"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm",
                              isCorrect ? "bg-secondary text-white" : "bg-surface-container-lowest"
                            )}>
                              {label}
                            </div>
                            <input 
                              className="flex-grow bg-transparent border-0 text-sm focus:ring-0 py-1" 
                              placeholder={q.type === "True/False" ? (label === "A" ? "True" : "False") : "Add option..."} 
                              type="text" 
                              disabled={q.type === "True/False"}
                              value={q.options[label as keyof typeof q.options] || ""}
                              onChange={(e) => {
                                const newOptions = { ...q.options, [label]: e.target.value };
                                handleUpdateQuestion(q.id, { options: newOptions });
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                              isCorrect ? "bg-secondary" : "border-2 border-outline-variant/30 hover:bg-secondary hover:border-secondary"
                            )}>
                              <Check className={cn("w-4 h-4 text-white", !isCorrect && "opacity-0 hover:opacity-100")} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx,.csv" 
              onChange={handleExcelImport}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full sm:w-1/2 py-8 border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center">
                <FileSpreadsheet className={cn("w-8 h-8", isImporting && "animate-pulse")} />
              </div>
              <span className="font-bold text-sm uppercase tracking-widest">
                {isImporting ? "Importing..." : "Import from Excel"}
              </span>
            </button>

            <button 
              onClick={handleAddQuestion}
              className="w-full sm:w-1/2 py-8 border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center">
                <Plus className="w-8 h-8" />
              </div>
              <span className="font-bold text-sm uppercase tracking-widest">Add New Question</span>
            </button>
          </div>
        </section>

        <div className="mt-20 rounded-3xl overflow-hidden relative h-64 shadow-xl">
          <img 
            alt="Classroom atmosphere" 
            className="w-full h-full object-cover grayscale opacity-20" 
            src="https://picsum.photos/seed/classroom/1200/400" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
          <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
            <div className="max-w-md">
              <h3 className="text-2xl font-bold font-headline text-on-surface mb-2">Review Your Settings</h3>
              <p className="text-sm text-on-surface-variant">Ensure your questions are peer-reviewed and time-calibrated for the best learning outcomes.</p>
            </div>
            <div className="hidden md:flex gap-4">
              <div className="bg-surface-container-lowest p-4 rounded-2xl text-center shadow-sm min-w-[100px]">
                <span className="block text-2xl font-bold text-primary">12</span>
                <span className="text-[10px] font-bold uppercase text-on-surface-variant">Avg Minutes</span>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-2xl text-center shadow-sm min-w-[100px]">
                <span className="block text-2xl font-bold text-tertiary">High</span>
                <span className="text-[10px] font-bold uppercase text-on-surface-variant">Cognitive Load</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AIChatAssistant />
      <BottomNavBar />
    </div>
  );
}
