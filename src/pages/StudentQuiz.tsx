import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { Info, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect } from "react";
import { useQuiz } from "@/src/context/QuizContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";

export default function StudentQuiz() {
  const { quiz, currentStudentRoll, updateParticipant, participants, calculateScore, loading: quizLoading } = useQuiz();
  const navigate = useNavigate();
  
  const participant = participants.find(p => p.roll === currentStudentRoll);
  const currentQuestionIndex = participant?.progress ?? 0;
  
  // Get the current question based on shuffled order
  const currentQuestionId = participant?.questionOrder?.[currentQuestionIndex];
  const currentQuestion = quiz?.questions.find(q => q.id === currentQuestionId);
  
  const totalQuestions = participant?.questionOrder?.length || quiz?.questions.length || 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  
  const [response, setResponse] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | string[] | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [quizEnded, setQuizEnded] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timeLeftRef = React.useRef<number | null>(null);
  const cheatProcessingRef = React.useRef(false);

  useEffect(() => {
    timeLeftRef.current = questionTimeLeft;
  }, [questionTimeLeft]);

  // Heartbeat to update lastSeen
  useEffect(() => {
    if (!currentStudentRoll || isFinished || quizEnded) return;

    const heartbeat = setInterval(async () => {
      try {
        const updates: any = { lastSeen: Date.now() };
        if (currentQuestion && timeLeftRef.current !== null) {
          updates.questionTimers = {
            ...(participant?.questionTimers || {}),
            [currentQuestion.id]: timeLeftRef.current
          };
        }
        await updateParticipant(currentStudentRoll, updates);
      } catch (err) {
        console.error("Heartbeat failed:", err);
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(heartbeat);
  }, [currentStudentRoll, isFinished, quizEnded]);

  // Cheat Detection: Visibility Change and Blur
  useEffect(() => {
    if (!currentStudentRoll || isFinished || quizEnded) return;

    const recordStrike = async () => {
      if (cheatProcessingRef.current) return;
      cheatProcessingRef.current = true;
      
      try {
        // Re-calculate strikes from current data
        const currentStrikes = (participant?.cheatStrikes || 0) + 1;
        
        if (currentStrikes >= 2) {
          console.warn("Cheat detected: Second strike. Auto-submitting quiz.");
          await handleCheatSubmit();
        } else {
          await updateParticipant(currentStudentRoll, { cheatStrikes: currentStrikes });
          // Force a small delay to prevent multiple triggers from same event cascade
          setTimeout(() => {
            cheatProcessingRef.current = false;
          }, 1000);
          return; // Skip finally block resetting immediately
        }
      } catch (err) {
        console.error("Failed to record cheat strike:", err);
      } 
      cheatProcessingRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordStrike();
      } else {
        if (participant?.cheatStrikes === 1 && !isFinished) {
          setShowCheatWarning(true);
        }
      }
    };

    const handleBlur = () => {
      recordStrike();
    };

    const handleFocus = () => {
      if (participant?.cheatStrikes === 1 && !isFinished) {
        setShowCheatWarning(true);
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      // Prevent navigation back by pushing current state back to keep user on same screen
      window.history.pushState(null, "", window.location.href);
      recordStrike();
    };

    // Initialize history state to capture back button
    window.history.pushState(null, "", window.location.href);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("popstate", handlePopState);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentStudentRoll, isFinished, quizEnded, participant?.cheatStrikes]);

  const handleCheatSubmit = async () => {
    if (submitting || !currentStudentRoll || !quiz) return;
    setSubmitting(true);
    
    try {
      const timeTaken = participant?.startTime ? Math.floor((Date.now() - participant.startTime) / 1000) : 0;
      
      // Calculate score based on CURRENT answers in participant object
      const score = calculateScore(participant!, quiz, undefined, true);

      await updateParticipant(currentStudentRoll, { 
        status: 'Submitted',
        timeTaken,
        score,
        cheatStrikes: 2
      });
      setIsFinished(true);
      navigate("/score");
    } catch (err) {
      console.error("Cheat submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Browser-level warning for refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isFinished) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isFinished]);

  const handleLeaveQuiz = async () => {
    if (!currentStudentRoll || !participant) return;
    
    try {
      await updateParticipant(currentStudentRoll, { 
        status: 'Submitted',
        progress: currentQuestionIndex
      });
      setIsFinished(true);
      setShowLeaveWarning(false);
    } catch (err) {
      console.error("Failed to submit on leave:", err);
    }
  };

  const handleSubmit = async (isAutoAdvance = false) => {
    if (submitting || !currentStudentRoll || !quiz || !currentQuestion) return;
    setSubmitting(true);
    
    try {
      const answer = currentQuestion.type === "Paragraph" ? response : selectedOption;
      
      // Use the most up-to-date answers from the participant object
      const currentAnswers = participant?.answers || {};
      const updatedAnswers = { ...currentAnswers, [currentQuestion.id]: answer || "" };
      
      // Mark as expired if the timer actually ran out
      const updatedExpiries = {
        ...(participant?.questionExpiries || {}),
        [currentQuestion.id]: isAutoAdvance ? 0 : (participant?.questionExpiries?.[currentQuestion.id] || Date.now())
      };

      if (isLastQuestion) {
        const timeTaken = participant?.startTime ? Math.floor((Date.now() - participant.startTime) / 1000) : 0;
        
        // Calculate score (excluding paragraphs for initial student score)
        const finalParticipant = { ...participant!, answers: updatedAnswers };
        const score = calculateScore(finalParticipant, quiz, undefined, true);

        await updateParticipant(currentStudentRoll, { 
          status: 'Submitted',
          answers: updatedAnswers,
          questionExpiries: updatedExpiries,
          progress: currentQuestionIndex,
          timeTaken,
          score
        });
        setIsFinished(true);
        navigate("/score");
      } else {
        await updateParticipant(currentStudentRoll, { 
          status: 'Appearing',
          answers: updatedAnswers,
          questionExpiries: updatedExpiries,
          progress: currentQuestionIndex + 1
        });
      }
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (currentQuestion && !isFinished && !quizEnded && currentStudentRoll) {
      const now = Date.now();
      let expiry = participant?.questionExpiries?.[currentQuestion.id];
      
      // If no expiry set yet, set it now
      if (!expiry) {
        expiry = now + (currentQuestion.timer * 1000);
        updateParticipant(currentStudentRoll, {
          questionExpiries: {
            ...(participant?.questionExpiries || {}),
            [currentQuestion.id]: expiry
          }
        });
      }

      const calculateTimeLeft = () => {
        const remaining = Math.max(0, Math.floor((expiry! - Date.now()) / 1000));
        setQuestionTimeLeft(remaining);
        return remaining;
      };

      calculateTimeLeft();
      const timer = setInterval(() => {
        const remaining = calculateTimeLeft();
        if (remaining <= 0) {
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentQuestionIndex, currentQuestion?.id, isFinished, quizEnded, currentStudentRoll]);

  useEffect(() => {
    if (questionTimeLeft === 0 && !isFinished && !quizEnded && !submitting) {
      handleSubmit(true);
    }
  }, [questionTimeLeft, isFinished, quizEnded, submitting]);

  useEffect(() => {
    if (!quizLoading && (!quiz || !currentStudentRoll)) {
      navigate("/join");
      return;
    }
    if (quiz && !quiz.isActive && !isFinished) {
      setQuizEnded(true);
    }
    if (participant?.status === 'Submitted') {
      navigate("/score");
    }
  }, [quiz, currentStudentRoll, navigate, quizLoading, isFinished, participant?.status]);

  useEffect(() => {
    const words = response.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [response]);

  // Load existing answer when question changes
  useEffect(() => {
    if (!currentQuestion) return;
    
    const existingAnswer = participant?.answers?.[currentQuestion.id];
    if (currentQuestion.type === "Paragraph") {
      setResponse(typeof existingAnswer === 'string' ? existingAnswer : "");
    } else {
      setSelectedOption(existingAnswer || null);
    }
  }, [currentQuestionIndex, currentQuestion?.id]);

  const handleResponseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setResponse(val);
  };

  // Debounced save for paragraph responses
  useEffect(() => {
    if (currentQuestion?.type !== "Paragraph" || !currentStudentRoll || !currentQuestion || isFinished || quizEnded) return;
    
    const timer = setTimeout(async () => {
      const currentAnswers = participant?.answers || {};
      // Only update if the answer has actually changed
      if (currentAnswers[currentQuestion.id] !== response) {
        await updateParticipant(currentStudentRoll, { 
          status: 'Appearing',
          answers: { ...currentAnswers, [currentQuestion.id]: response }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [response, currentQuestion?.id, currentStudentRoll, isFinished, quizEnded]);

  const handleOptionSelect = async (optionId: string) => {
    if (isExpired) return;

    let nextOption: string | string[] | null = null;
    if (currentQuestion?.type === "Multiple Correct" || currentQuestion?.type === "MSQ") {
      const current = Array.isArray(selectedOption) ? selectedOption : [];
      nextOption = current.includes(optionId) 
        ? current.filter(id => id !== optionId) 
        : [...current, optionId];
      setSelectedOption(nextOption);
    } else {
      nextOption = optionId;
      setSelectedOption(optionId);
    }
    
    if (currentStudentRoll && currentQuestion) {
      const currentAnswers = participant?.answers || {};
      await updateParticipant(currentStudentRoll, { 
        status: 'Appearing',
        answers: { ...currentAnswers, [currentQuestion.id]: nextOption || "" }
      });
    }
  };

  if (quizLoading || (currentStudentRoll && !participant)) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isFinished || quizEnded) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface-container-lowest p-12 rounded-3xl shadow-xl border border-surface-container max-w-md w-full"
        >
          <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Info className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-headline text-3xl font-extrabold mb-4 text-on-surface">
            Quiz Ended
          </h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            The quiz has been ended by the teacher. If you have any problems, please contact your teacher.
          </p>
          <button 
            onClick={() => navigate("/join")}
            className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Back to Join Page
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const progressPercent = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isQuestionTimeLow = questionTimeLeft !== null && questionTimeLeft < 10;
  const isTimeLow = isQuestionTimeLow;
  const isExpired = questionTimeLeft === 0;

  return (
    <div className="bg-surface min-h-screen pb-24 flex flex-col">
      <TopAppBar 
        variant="quiz" 
        progress={progressPercent} 
        currentTask={`Question ${currentQuestionIndex + 1} of ${totalQuestions}`} 
        timeLeft={questionTimeLeft !== null ? `${questionTimeLeft}s` : "..."} 
        isLowTime={isTimeLow}
        onLogoClick={() => setShowLeaveWarning(true)}
      />

      {/* Question Timer Progress Bar */}
      {questionTimeLeft !== null && currentQuestion && (
        <div className="w-full h-1.5 bg-surface-container-low overflow-hidden">
          <motion.div 
            initial={{ width: "100%" }}
            animate={{ width: `${(questionTimeLeft / currentQuestion.timer) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
            className={cn(
              "h-full transition-colors duration-500",
              isQuestionTimeLow ? "bg-error" : "bg-primary"
            )}
          />
        </div>
      )}
      
      <main className="flex-grow flex flex-col items-center justify-start p-6 md:p-12 max-w-3xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full space-y-8"
          >
            {/* Question Type & Timer Section (Matching Image) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 font-headline">Question Type</label>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 text-on-surface font-headline font-bold">
                  {currentQuestion.type}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 font-headline text-center block">Timer</label>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="flex items-baseline gap-1 relative z-10">
                    <span className={cn(
                      "text-2xl font-headline font-extrabold transition-colors",
                      isQuestionTimeLow ? "text-error" : "text-on-surface"
                    )}>
                      {questionTimeLeft ?? currentQuestion.timer}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant">s</span>
                  </div>
                  <div className="w-full h-1 bg-surface-container-highest mt-2 rounded-full overflow-hidden relative z-10">
                    <motion.div 
                      initial={{ width: "100%" }}
                      animate={{ width: `${((questionTimeLeft ?? currentQuestion.timer) / currentQuestion.timer) * 100}%` }}
                      className={cn("h-full transition-colors", isQuestionTimeLow ? "bg-error" : "bg-primary")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Question Text Section (Matching Image) */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 font-headline">Question</label>
                {isExpired && (
                  <span className="px-3 py-1 bg-error/10 text-error text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1.5 animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Time Expired
                  </span>
                )}
              </div>
              <div className={cn(
                "bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 min-h-[120px] flex items-center transition-opacity",
                isExpired && "opacity-60"
              )}>
                <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface leading-tight tracking-tight">
                  {currentQuestion.text || `Question ${currentQuestionIndex + 1}`}
                </h1>
              </div>
            </div>

            {/* Options Section (Matching Image) */}
            <div className="space-y-4">
              {currentQuestion.type === "Paragraph" ? (
                <>
                  <div className={cn(
                    "group relative bg-surface-container-lowest rounded-2xl p-1 transition-all duration-300",
                    isExpired && "opacity-50 pointer-events-none"
                  )}>
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-sm opacity-50 group-focus-within:opacity-100 transition-opacity"></div>
                    <div className="relative bg-surface-container-lowest rounded-[14px] overflow-hidden">
                      <textarea 
                        value={response}
                        onChange={handleResponseChange}
                        disabled={isExpired}
                        className="w-full h-64 p-8 bg-transparent border-none focus:ring-0 font-body text-lg leading-relaxed text-on-surface placeholder:text-outline-variant resize-none" 
                        placeholder={isExpired ? "Time has expired for this question." : "Type your explanation here..."} 
                      />
                      <div className="px-8 py-4 bg-surface-container-low/50 flex justify-between items-center border-t border-outline-variant/10">
                        <span className="text-xs font-label text-on-surface-variant flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Maximum 50 words
                        </span>
                        <span className={cn(
                          "text-xs font-label",
                          wordCount > 50 ? "text-error font-bold" : "text-on-surface-variant"
                        )}>{wordCount}/50 words</span>
                      </div>
                    </div>
                  </div>
                  {wordCount > 50 && !isExpired && (
                    <p className="text-error text-xs font-bold mt-2 px-2">Please reduce your answer to 50 words or less.</p>
                  )}
                </>
              ) : (
                <div className={cn("grid grid-cols-1 gap-3", isExpired && "opacity-60")}>
                  {(participant?.optionOrders?.[currentQuestion.id] || (currentQuestion.type === "True/False" ? ['A', 'B'] : ['A', 'B', 'C', 'D'])).filter(label => {
                    if (currentQuestion.type === "True/False") return label === 'A' || label === 'B';
                    return true;
                  }).map((label, idx) => {
                    const isSelected = Array.isArray(selectedOption) 
                      ? selectedOption.includes(label) 
                      : selectedOption === label;

                    return (
                      <button
                        key={label}
                        onClick={() => !isExpired && handleOptionSelect(label)}
                        disabled={isExpired}
                        className={cn(
                          "w-full p-4 rounded-2xl text-left font-headline font-bold text-lg transition-all border-2 flex items-center justify-between group",
                          isSelected 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm" 
                            : "bg-surface-container-lowest border-outline-variant/10 text-on-surface hover:border-primary/30",
                          isExpired && "cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors",
                            isSelected ? "bg-emerald-500 text-white" : "bg-surface-container-low text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary",
                            isExpired && "group-hover:bg-surface-container-low group-hover:text-on-surface-variant"
                          )}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-base">{currentQuestion.options[label] || `Option ${label}`}</span>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-emerald-500 border-emerald-500" : "border-outline-variant/30"
                        )}>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="pt-8 flex flex-col gap-4">
              <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 text-center space-y-2 shadow-sm">
                <p className="text-on-surface font-headline font-bold">
                  {isLastQuestion ? "Quiz will be submitted automatically" : "Next question will appear automatically"}
                </p>
                <p className="text-xs text-on-surface-variant font-medium">
                  {isLastQuestion ? "when the timer reaches zero." : "when the current timer ends."}
                </p>
              </div>

              <button 
                onClick={() => setShowLeaveWarning(true)}
                className="w-full py-3 text-on-surface-variant font-headline font-bold hover:text-error transition-colors text-sm"
              >
                Leave Quiz
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Leave Warning Modal */}
        <AnimatePresence>
          {showLeaveWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface-container-lowest p-8 rounded-3xl shadow-2xl border border-surface-container max-w-md w-full"
              >
                <h3 className="font-headline text-2xl font-extrabold mb-4 text-on-surface">Leave Quiz?</h3>
                <p className="text-on-surface-variant mb-8">
                  If you leave now, your quiz will be submitted with your current progress. Any unanswered questions will be marked as skipped.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowLeaveWarning(false)}
                    className="flex-1 py-4 bg-surface-container-low text-on-surface font-headline font-bold rounded-xl hover:bg-surface-container transition-all"
                  >
                    Stay
                  </button>
                  <button 
                    onClick={handleLeaveQuiz}
                    className="flex-1 py-4 bg-error text-on-error font-headline font-bold rounded-xl shadow-lg shadow-error/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Submit & Leave
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Cheat Warning Modal */}
        <AnimatePresence>
          {showCheatWarning && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 40 }}
                className="bg-surface rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-outline-variant/20 max-w-md w-full overflow-hidden"
              >
                <div className="h-2 bg-error"></div>
                <div className="p-10 text-center">
                  <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                    <div className="absolute inset-0 rounded-full animate-ping bg-error/20"></div>
                    <AlertCircle className="w-12 h-12 text-error relative z-10" />
                  </div>
                  
                  <h3 className="font-headline text-3xl font-black mb-4 text-on-surface tracking-tighter">
                    Integrity Check
                  </h3>
                  
                  <p className="text-on-surface-variant font-medium mb-10 leading-relaxed">
                    We noticed you <span className="underline decoration-error decoration-2 underline-offset-4 font-bold text-on-surface italic">navigated away</span> from the quiz. 
                    <br /><br />
                    To maintain fairness, this is your <span className="text-error font-black uppercase">Final Warning</span>. If you switch tabs or minimize again, your quiz will be 
                    <span className="underline decoration-error decoration-2 underline-offset-4 font-black mx-1">submitted immediately</span>.
                  </p>
                  
                  <button 
                    onClick={() => setShowCheatWarning(false)}
                    className="w-full py-5 bg-on-surface text-surface font-headline font-black rounded-2xl shadow-xl hover:bg-on-surface/90 hover:scale-[1.02] active:scale-98 transition-all duration-300"
                  >
                    RETURN TO QUIZ
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Decorative Kinetic Elements */}
      <div className="fixed bottom-0 left-0 -z-10 w-full h-1/2 overflow-hidden opacity-30 pointer-events-none">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 320">
          <path d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,149.3C672,149,768,203,864,213.3C960,224,1056,192,1152,176C1248,160,1344,160,1392,160L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" fill="#809bff" fillOpacity="0.1"></path>
        </svg>
      </div>
    </div>
  );
}
