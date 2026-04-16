import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { ArrowRight, Radio, Hourglass, CheckCircle2, Info, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuiz } from "@/src/context/QuizContext";
import { cn } from "@/src/lib/utils";
import { useEffect } from "react";

export default function StudentJoin() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || "";
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const { quiz, findQuizByRoomCode, joinQuiz, participants, isRollAllowed } = useQuiz();
  const navigate = useNavigate();
  const [history] = useState(() => JSON.parse(localStorage.getItem('quizHistory') || '[]'));

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      validateCode(initialCode);
    }
  }, [initialCode]);

  const validateCode = async (inputCode: string) => {
    const cleanCode = inputCode.replace(/[^A-Z0-9]/gi, '');
    if (cleanCode.length === 6) {
      setIsValidating(true);
      const found = await findQuizByRoomCode(inputCode);
      setIsCodeValid(!!found);
      if (!found) setError("Invalid room code");
      else setError("");
      setIsValidating(false);
    } else {
      setIsCodeValid(false);
      setError("");
    }
  };

  const handleJoin = async () => {
    if (!code) {
      setError("Please enter a room code");
      return;
    }

    let targetQuiz = quiz;
    if (!isCodeValid || !targetQuiz) {
      setIsValidating(true);
      const found = await findQuizByRoomCode(code);
      setIsValidating(false);
      if (!found) {
        setError("Invalid room code");
        return;
      }
      setIsCodeValid(true);
      targetQuiz = found;
    }

    if (!name || !roll) {
      setError("Please enter your name and roll number");
      return;
    }

    // Roll number validation
    if (targetQuiz.allowedRollPatterns && targetQuiz.allowedRollPatterns.length > 0) {
      if (!isRollAllowed(roll, targetQuiz.allowedRollPatterns)) {
        setError(`The allowed types are ${targetQuiz.allowedRollPatterns.join(", ")} for further assistance talk to teacher.`);
        return;
      }
    }

    try {
      const joined = await joinQuiz({ name, roll }, targetQuiz);
      
      if (!joined) {
        setError("This quiz has either ended or is no longer active.");
        return;
      }

      // Check if this student already submitted
      const p = participants.find(part => part.roll === roll);
      if (p?.status === 'Submitted') {
        navigate("/score");
      } else {
        navigate("/quiz");
      }
    } catch (err) {
      console.error("Join error:", err);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="bg-surface min-h-screen pb-24 flex flex-col">
      <TopAppBar />
      
      <main className="flex-grow flex items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-primary-container/10 blur-[100px] -z-10"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[35rem] h-[35rem] rounded-full bg-secondary-container/10 blur-[80px] -z-10"></div>
        
        <div className="w-full max-w-lg">
          <div className="text-left mb-10">
            <h2 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface tracking-tight mb-4">Join Quiz Room</h2>
            <p className="text-on-surface-variant text-lg max-w-md">Enter your details and the unique 6-digit code provided by your educator.</p>
          </div>

          <div className="grid gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/15 shadow-[0_20px_40px_rgba(42,43,81,0.06)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Radio className="w-24 h-24" />
              </div>
              
              <div className="relative z-10">
                <label className="block text-sm font-semibold text-on-surface-variant uppercase tracking-widest mb-3" htmlFor="room-code">Room Code</label>
                <div className="group relative mb-8">
                  <input 
                    id="room-code"
                    value={code}
                    onChange={(e) => { 
                      const val = e.target.value.toUpperCase();
                      setCode(val); 
                      setError("");
                      validateCode(val);
                    }}
                    className="w-full bg-surface-container-low border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 text-3xl md:text-4xl font-headline font-bold tracking-[0.2em] py-4 px-4 placeholder:text-outline-variant/30 transition-all duration-300 text-center rounded-t-lg" 
                    maxLength={8}
                    placeholder="000-000" 
                    type="text" 
                  />
                  {isValidating && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                  {isCodeValid && !isValidating && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isCodeValid && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6 overflow-hidden"
                    >
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
                        <p className="text-emerald-800 text-sm font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Room Found: <span className="underline">{quiz?.title}</span>
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-on-surface-variant uppercase tracking-widest mb-3" htmlFor="student-name">Full Name</label>
                        <input 
                          id="student-name"
                          value={name}
                          onChange={(e) => { setName(e.target.value); setError(""); }}
                          className="w-full bg-surface-container-low border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 text-xl font-headline font-bold py-4 px-4 placeholder:text-outline-variant/30 transition-all duration-300 rounded-t-lg" 
                          placeholder="Enter your full name" 
                          type="text" 
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-on-surface-variant uppercase tracking-widest mb-3" htmlFor="roll-number">Roll Number</label>
                        <input 
                          id="roll-number"
                          value={roll}
                          onChange={(e) => { setRoll(e.target.value); setError(""); }}
                          className="w-full bg-surface-container-low border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 text-xl font-headline font-bold py-4 px-4 placeholder:text-outline-variant/30 transition-all duration-300 rounded-t-lg" 
                          placeholder="Enter your roll number" 
                          type="text" 
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-error text-sm font-bold mt-6 flex items-center gap-2 bg-error/10 p-3 rounded-lg"
                  >
                    <Info className="w-4 h-4" />
                    {error}
                  </motion.p>
                )}
                
                <div className="mt-10">
                  <button 
                    onClick={handleJoin}
                    disabled={isValidating}
                    className={cn(
                      "w-full py-4 px-6 rounded-xl font-headline font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                      isCodeValid 
                        ? "bg-primary text-on-primary shadow-primary/20" 
                        : "bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isCodeValid ? "Enter Quiz Room" : "Enter Room Code Above"}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>

            {history.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-surface-container-low/50 p-6 rounded-xl border border-outline-variant/10"
              >
                <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                  <Hourglass className="w-4 h-4" />
                  Recent Quizzes
                </h3>
                <div className="space-y-3">
                  {history.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => setCode(item.roomCode)}
                      className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/5 hover:border-primary/30 transition-all group text-left"
                    >
                      <div>
                        <div className="font-bold text-on-surface group-hover:text-primary transition-colors">{item.title}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">{item.roomCode}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-outline-variant group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-12 flex items-start gap-4 p-4 rounded-lg bg-surface-container-high/50">
            <Info className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Make sure your internet connection is stable. If you drop out, simply re-enter the code to rejoin the session.
            </p>
          </div>
        </div>
      </main>

      <BottomNavBar />
    </div>
  );
}
