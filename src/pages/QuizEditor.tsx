import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { Rocket, Trash2, Copy, Plus, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useQuiz } from "@/src/context/QuizContext";
import AIChatAssistant from "@/src/components/AIChatAssistant";

export default function QuizEditor() {
  const { createQuiz, saveDraft, draftQuiz, quizzes, quizEnded, closeQuizEndedMessage } = useQuiz();
  const [title, setTitle] = useState("");
  const activeQuiz = quizzes.find(q => q.isActive);
  const [questions, setQuestions] = useState([{ 
    id: "1", 
    text: "", 
    correctOption: null as string | null, 
    type: "Multiple Choice", 
    timer: 45,
    options: { A: "", B: "", C: "", D: "" }
  }]);
  const totalQuestions = questions.length;
  const [drawCount, setDrawCount] = useState(1);
  const [hasManuallySetDrawCount, setHasManuallySetDrawCount] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    if (!hasManuallySetDrawCount) {
      setDrawCount(questions.length);
    } else if (drawCount > questions.length) {
      setDrawCount(questions.length);
    }
  }, [questions.length, hasManuallySetDrawCount, drawCount]);

  const handleSaveDraft = () => {
    if (totalQuestions <= 0 || drawCount <= 0 || drawCount > totalQuestions) {
      alert("Please ensure Total Questions and Draw Count are valid (greater than 0 and Draw Count <= Total Questions).");
      return;
    }
    saveDraft({
      title,
      totalQuestions,
      drawCount,
      questions: questions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type || "Multiple Choice",
        timer: q.timer || 45,
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
      correctOption: null, 
      type: "Multiple Choice", 
      timer: 45,
      options: { A: "", B: "", C: "", D: "" }
    }]);
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
    console.log("Handle Save started", { title, totalQuestions, drawCount, questionsCount: questions.length });
    if (!title) {
      setValidationError("Please enter a quiz title.");
      return;
    }

    if (drawCount <= 0) {
      setValidationError("Draw count must be greater than 0.");
      return;
    }

    if (drawCount > questions.length) {
      setValidationError(`Draw count (${drawCount}) cannot be greater than total questions (${questions.length}).`);
      return;
    }
    
    const missingCorrect = questions.filter(q => q.type !== "Paragraph" && (!q.correctOption || (Array.isArray(q.correctOption) && q.correctOption.length === 0)));
    if (missingCorrect.length > 0) {
      setValidationError("Correct answer is missing for some questions. Please add the correct answer before creating a room.");
      return;
    }

    if (questions.some(q => !q.text.trim())) {
      setValidationError("Please enter text for all questions.");
      return;
    }

    if (questions.some(q => q.type !== "Paragraph" && q.type !== "True/False" && (Object.values(q.options) as string[]).some(opt => !opt.trim()))) {
      setValidationError("Please fill in all options for all questions.");
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
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          type: q.type || "Multiple Choice",
          timer: q.timer || 45,
          options: q.options,
          correctOption: q.correctOption || ""
        })),
        allowedRollPatterns,
        isActive: true,
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
                onClick={handleSaveDraft}
                className="px-6 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-semibold hover:bg-surface-container-low transition-colors"
              >
                Save Draft
              </button>
              <button 
                onClick={handleSave}
                disabled={!!activeQuiz || isSaving}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-dim text-white font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
              >
                <span>{isSaving ? "Saving..." : "Generate Room Code & Save"}</span>
                <Rocket className={cn("w-5 h-5", isSaving && "animate-bounce")} />
              </button>
            </div>
          </div>
        </header>

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
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant/10">
              <p className="text-[10px] text-on-surface-variant leading-tight">Randomizes question delivery per student session for integrity.</p>
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
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Question {index + 1} Type</label>
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
                        value={q.timer || 45} 
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
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Question</label>
                    <textarea 
                      value={q.text}
                      onChange={(e) => handleUpdateQuestion(q.id, { text: e.target.value })}
                      className="w-full bg-surface-container-low border-0 rounded-xl p-4 text-lg font-medium focus:ring-2 focus:ring-primary-container resize-none" 
                      placeholder="Enter your question here..." 
                      rows={2}
                    />
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

          <button 
            onClick={handleAddQuestion}
            className="w-full py-8 border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center">
              <Plus className="w-8 h-8" />
            </div>
            <span className="font-bold text-sm uppercase tracking-widest">Add New Question</span>
          </button>
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
