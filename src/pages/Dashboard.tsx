import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { Copy, Filter, Download, PlusCircle, Radio, Search, ArrowRight, Award, Info, Rocket, QrCode, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from 'qrcode.react';
import { useQuiz, LOBBY_COUNTDOWN_SECONDS } from "@/src/context/QuizContext";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const { quiz, participants, loading, endQuiz, startSession } = useQuiz();
  const { profile } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const navigate = useNavigate();

  // Lobby countdown state for teacher
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (quiz?.status === 'starting' && quiz.startedAt) {
      const startedAt = typeof quiz.startedAt === 'string' ? new Date(quiz.startedAt).getTime() : 
                        (quiz.startedAt.toMillis ? quiz.startedAt.toMillis() : Date.now());
      
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - startedAt) / 1000;
        const remaining = Math.max(0, Math.ceil(LOBBY_COUNTDOWN_SECONDS - elapsed));
        setLobbyCountdown(remaining);
        
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setLobbyCountdown(null);
    }
  }, [quiz?.status, quiz?.startedAt]);

  const handleCopy = () => {
    if (quiz?.roomCode) {
      navigator.clipboard.writeText(quiz.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEndQuiz = async () => {
    if (quiz?.id) {
      await endQuiz(quiz.id);
      navigate("/quiz-editor");
    }
  };

  const handleStartQuiz = async () => {
    if (quiz?.id) {
      // Final safety check: ensure no scorable questions are missing correct answers
      const invalidQuestions = quiz.questions?.filter(q => 
        q.type !== "Paragraph" && 
        (!q.correctOption || (Array.isArray(q.correctOption) && q.correctOption.length === 0))
      );
      
      if (invalidQuestions && invalidQuestions.length > 0) {
        alert(`Cannot start quiz: ${invalidQuestions.length} questions are missing correct answers. Please edit the quiz to fix them.`);
        return;
      }
      
      await startSession(quiz.id);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface min-h-screen pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isStudent = profile?.role === 'Student';
  const isLobby = quiz?.status === 'waiting' || quiz?.status === 'starting';

  if (isStudent) {
    return (
      <div className="bg-surface min-h-screen pb-24">
        <TopAppBar />
        <main className="max-w-screen-2xl mx-auto px-6 pt-12 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-headline text-5xl font-extrabold tracking-tight mb-4">Welcome, {profile?.full_name}!</h1>
            <p className="text-on-surface-variant text-xl">Ready to test your knowledge? Join a live quiz session.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-lowest p-10 md:p-16 rounded-[3rem] shadow-2xl border border-outline-variant/10 max-w-2xl w-full relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[5rem] -z-10"></div>
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-8">
              <Radio className="w-10 h-10 text-primary animate-pulse" />
            </div>
            
            <h2 className="font-headline text-3xl font-bold mb-6">Enter Room Code</h2>
            <div className="space-y-6">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-outline group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="e.g. 123456"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full pl-14 pr-6 py-6 bg-surface-container-low border-2 border-outline-variant/30 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-headline text-2xl font-black tracking-[0.5em] placeholder:tracking-normal placeholder:font-bold"
                />
              </div>
              
              <button 
                onClick={() => navigate(`/join?code=${roomCode}`)}
                disabled={!roomCode}
                className="w-full py-6 bg-primary text-on-primary font-headline font-bold text-xl rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
              >
                Join Quiz Session
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </motion.div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            {[
              { label: "Quizzes Joined", value: "0", icon: Radio, color: "text-blue-500" },
              { label: "Avg. Accuracy", value: "0%", icon: Award, color: "text-amber-500" },
              { label: "Points Earned", value: "0", icon: PlusCircle, color: "text-emerald-500" },
            ].map((stat, i) => (
              <div key={stat.label} className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5 flex flex-col items-center text-center">
                <stat.icon className={cn("w-8 h-8 mb-3", stat.color)} />
                <div className="text-2xl font-black font-headline">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</div>
              </div>
            ))}
          </div>
        </main>
        <BottomNavBar />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="bg-surface min-h-screen pb-24">
        <TopAppBar />
        <main className="max-w-screen-2xl mx-auto px-6 pt-20 flex flex-col items-center justify-center text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-container-lowest p-12 rounded-3xl shadow-sm border border-surface-container max-w-lg w-full"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <PlusCircle className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-headline text-3xl font-extrabold mb-4">No Active Quiz</h2>
            <p className="text-on-surface-variant mb-8">You haven't created any live sessions yet. Start by building a new quiz for your students.</p>
            <Link 
              to="/quiz-editor"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Create New Quiz
            </Link>
          </motion.div>
        </main>
        <BottomNavBar />
      </div>
    );
  }

  const truncateScore = (score: number) => Math.floor(score * 100) / 100;

  // Calculate dynamic stats
  const totalParticipants = participants.length;
  
  let totalCorrect = 0;
  let totalAnswered = 0;
  
  participants.forEach(p => {
    if (p.answers) {
      Object.entries(p.answers).forEach(([qId, selectedOption]) => {
        const question = quiz.questions?.find(q => q.id === qId);
        if (question?.type !== 'Paragraph') {
          if (question?.correctOption === selectedOption) totalCorrect++;
          totalAnswered++;
        }
      });
    }
  });

  const participationRate = totalParticipants > 0 ? 100 : 0;

  // Calculate average raw score for the current quiz
  let totalRawScore = 0;
  let submittedCount = 0;
  participants.forEach(p => {
    if (p.status === 'Submitted') {
      totalRawScore += truncateScore(p.score || 0);
      submittedCount++;
    }
  });
  const avgRawScore = submittedCount > 0 ? Math.round((totalRawScore / submittedCount) * 100) / 100 : 0;
  
  const scorableQuestions = quiz.questions?.filter(q => q.type !== 'Paragraph') || [];
  const totalScorable = scorableQuestions.length;
  const avgPercentage = totalScorable > 0 ? (avgRawScore / totalScorable) * 100 : 0;

  return (
    <div className="bg-surface min-h-screen pb-24">
      <TopAppBar />
      
      <main className="max-w-screen-2xl mx-auto px-6 pt-8">
        {/* Live Session Status */}
        <section className="mb-8">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-xs uppercase mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live Session Active
          </div>
          <h2 className="font-headline text-4xl font-extrabold tracking-tight">Student Responses</h2>
          <p className="text-on-surface-variant mt-1">Quiz: {quiz.title}</p>
        </section>

        {/* Session Code Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest rounded-3xl p-6 mb-8 flex items-center justify-between shadow-sm border border-surface-container"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Room Code</span>
            <div className="text-3xl font-black font-headline text-primary">{quiz.roomCode}</div>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-on-surface-variant">
              <span className="font-bold">Share Link:</span>
              <span className="bg-surface-container-low px-2 py-1 rounded truncate max-w-[200px]">
                {window.location.origin}/join?code={quiz.roomCode.replace('-', '')}
              </span>
              <button 
                onClick={() => {
                  let publicOrigin = window.location.origin;
                  if (publicOrigin.includes('ais-dev')) {
                    publicOrigin = publicOrigin.replace('ais-dev', 'ais-pre');
                  }
                  navigator.clipboard.writeText(`${publicOrigin}/join?code=${quiz.roomCode.replace('-', '')}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-1 hover:bg-surface-container-high rounded transition-colors relative"
              >
                <Copy className="w-3 h-3" />
                {copied && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: -25 }}
                    exit={{ opacity: 0 }}
                    className="absolute whitespace-nowrap bg-on-surface text-surface text-[8px] py-0.5 px-1 rounded font-bold"
                  >
                    Link Copied
                  </motion.div>
                )}
              </button>
              <button 
                onClick={() => setShowQr(true)}
                className="p-1 hover:bg-surface-container-high rounded transition-colors"
                title="Show Join QR Code"
              >
                <QrCode className="w-3 h-3" />
              </button>
            </div>
            {window.location.hostname.includes('ais-dev') && (
              <p className="mt-2 text-[9px] text-emerald-600 font-medium flex items-center gap-1">
                <Info className="w-2.5 h-2.5" />
                Note: You are on a private dev link. The "Copy Link" button will automatically use the public "ais-pre" URL for your students.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-6 w-full lg:w-auto">
            <div className="flex flex-col items-center lg:items-end gap-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Joined Students</div>
              <div className="flex -space-x-3 justify-center overflow-hidden py-2">
                {participants.slice(0, 5).map((p, i) => {
                  const colors = [
                    'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 
                    'bg-orange-500', 'bg-rose-500', 'bg-indigo-500'
                  ];
                  const colorClass = colors[i % colors.length];
                  const initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
                  
                  return (
                    <motion.div
                      key={p.roll}
                      initial={{ scale: 0, x: 20 }}
                      animate={{ scale: 1, x: 0 }}
                      className={cn(
                        "inline-flex items-center justify-center h-10 w-10 rounded-full",
                        "ring-4 ring-surface-container-lowest text-white text-base font-bold shadow-lg shrink-0",
                        colorClass
                      )}
                      title={p.name}
                    >
                      {initial}
                    </motion.div>
                  );
                })}
                
                {participants.length > 5 && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full ring-4 ring-surface-container-lowest bg-surface-container-high text-on-surface text-xs font-bold shadow-lg z-10 shrink-0"
                  >
                    +{participants.length - 5}
                  </motion.div>
                )}
                
                {participants.length === 0 && (
                  <div className="text-xs text-on-surface-variant opacity-50 italic py-2">Waiting for first join...</div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              {quiz.status === 'waiting' && (
                <button 
                  onClick={handleStartQuiz}
                  className="px-8 h-14 rounded-2xl bg-primary text-on-primary font-headline font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Rocket className="w-5 h-5 text-white" />
                  Start Quiz
                </button>
              )}
              <button 
                onClick={() => setShowEndConfirm(true)}
                className="px-6 h-14 rounded-2xl bg-error/10 text-error font-headline font-bold hover:bg-error/20 transition-colors flex items-center justify-center gap-2"
              >
                End Quiz
              </button>
            </div>
          </div>
        </motion.div>

        {quiz.status === 'starting' && lobbyCountdown !== null && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-primary border-2 border-primary-dim p-10 rounded-[3rem] mb-8 flex flex-col items-center justify-center text-center gap-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center animate-bounce mb-2 relative">
               <Rocket className="w-12 h-12 text-white" />
               <div className="absolute -top-2 -right-2 bg-error text-white w-10 h-10 rounded-full flex items-center justify-center font-black text-xl shadow-lg border-2 border-white">
                 {lobbyCountdown}
               </div>
            </div>
            <div>
              <h3 className="font-headline text-4xl font-black text-white mb-2 tracking-tight">Quiz Starting for Everyone!</h3>
              <p className="text-white/80 font-bold text-lg">T-minus {lobbyCountdown} seconds until session goes active.</p>
              
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">Students Ready</div>
                <div className="flex -space-x-3 justify-center overflow-hidden py-2">
                  {participants.slice(0, 5).map((p, i) => {
                    const colors = [
                      'bg-blue-400', 'bg-purple-400', 'bg-emerald-400', 
                      'bg-orange-400', 'bg-rose-400', 'bg-indigo-400'
                    ];
                    const colorClass = colors[i % colors.length];
                    const initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
                    
                    return (
                      <motion.div
                        key={p.roll}
                        initial={{ scale: 0, x: 20 }}
                        animate={{ scale: 1, x: 0 }}
                        className={cn(
                          "inline-flex items-center justify-center h-12 w-12 rounded-full",
                          "ring-4 ring-primary text-white text-lg font-bold shadow-lg shrink-0",
                          colorClass
                        )}
                        title={p.name}
                      >
                        {initial}
                      </motion.div>
                    );
                  })}
                  
                  {participants.length > 5 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="inline-flex items-center justify-center h-12 w-12 rounded-full ring-4 ring-primary bg-white/20 text-white text-sm font-bold shadow-lg z-10 shrink-0 backdrop-blur-sm"
                    >
                      +{participants.length - 5}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="w-full max-w-md h-3 bg-white/10 rounded-full overflow-hidden mt-2">
              <motion.div 
                key="teacher-lobby-progress"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: LOBBY_COUNTDOWN_SECONDS, ease: "linear" }}
                className="h-full bg-white"
              />
            </div>
          </motion.div>
        )}

        {/* End Quiz Confirmation Modal */}
        <AnimatePresence>
          {showEndConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface-container-lowest p-8 rounded-3xl shadow-2xl border border-surface-container max-w-md w-full"
              >
                <h3 className="font-headline text-2xl font-extrabold mb-4 text-on-surface">End Quiz?</h3>
                <p className="text-on-surface-variant mb-8 leading-relaxed">
                  Are you sure you want to end this quiz? No more students will be able to join or submit answers. This action cannot be undone.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 py-4 bg-surface-container-low text-on-surface font-headline font-bold rounded-xl hover:bg-surface-container transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleEndQuiz}
                    className="flex-1 py-4 bg-error text-on-error font-headline font-bold rounded-xl shadow-lg shadow-error/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    End Quiz
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* QR Code Modal */}
        <AnimatePresence>
          {showQr && quiz && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-sm w-full relative"
              >
                <button 
                  onClick={() => setShowQr(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
                
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-headline text-2xl font-black text-gray-900 mb-1">Scan to Join</h3>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Room Code: {quiz.roomCode}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border-4 border-primary/5 shadow-inner mb-8">
                  <QRCodeSVG 
                    value={`${window.location.hostname.includes('ais-dev') 
                      ? window.location.origin.replace('ais-dev', 'ais-pre') 
                      : window.location.origin}/join?code=${quiz.roomCode.replace('-', '')}`}
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "https://picsum.photos/seed/quiz/128/128",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>

                <p className="text-center text-sm font-medium text-gray-600 px-4">
                  Ask students to scan this QR code with their phone camera to instantly join the session.
                </p>
                
                <div className="mt-8 pt-8 border-t border-gray-100 w-full flex justify-center">
                   <div className="bg-primary/5 px-6 py-3 rounded-2xl">
                     <span className="font-headline font-black text-2xl tracking-[0.2em] text-primary">{quiz.roomCode}</span>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Overviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Participation Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-low p-8 rounded-3xl border-b-4 border-primary"
          >
            <span className="font-label text-xs font-bold uppercase text-on-surface-variant">Participation</span>
            <div className="mt-4">
              <div className="text-4xl font-black font-headline mb-2">{totalParticipants} Students</div>
              <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-500" 
                  style={{ width: `${participationRate}%` }}
                ></div>
              </div>
            </div>
          </motion.div>

          {/* Average Score Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-low p-8 rounded-3xl border-b-4 border-tertiary"
          >
            <span className="font-label text-xs font-bold uppercase text-on-surface-variant">Average Score</span>
            <div className="mt-4">
              <div className="text-4xl font-black font-headline mb-2">
                {avgRawScore}
                <span className="text-sm text-on-surface-variant/50 ml-1">/{totalScorable}</span>
              </div>
              <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-tertiary h-full rounded-full transition-all duration-500" 
                  style={{ width: `${avgPercentage}%` }}
                ></div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Class List Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest rounded-3xl shadow-[0_20px_40px_rgba(42,43,81,0.03)] overflow-hidden"
        >
          <div className="p-8 border-b border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-headline text-2xl font-bold">Class List</h3>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {participants.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Student</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Roll Number</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Score</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Current Progress</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {participants.map((student, index) => (
                    <tr key={student.roll} className="group hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{index + 1}</div>
                          <span className="font-headline font-bold">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-medium text-sm text-on-surface-variant">{student.roll}</span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="font-headline font-black text-primary">
                          {student.score !== undefined ? truncateScore(student.score) : '-'}<span className="text-[10px] text-on-surface-variant/50 ml-0.5">/{totalScorable}</span>
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="bg-surface-container-highest px-3 py-1 rounded-full text-xs font-bold text-on-surface-variant">
                          Question {student.progress + 1}/{quiz.totalQuestions}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className={cn(
                          "flex items-center justify-end gap-2 font-bold text-sm",
                          student.status === 'Submitted' ? 'text-emerald-600' : 'text-primary'
                        )}>
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            student.status === 'Submitted' ? 'bg-emerald-500' : (
                              (student.lastSeen && Date.now() - student.lastSeen < 30000) ? 'bg-emerald-500 animate-pulse' : 'bg-outline-variant'
                            )
                          )}></span>
                          {student.status === 'Submitted' ? 'Submitted' : (
                            (student.lastSeen && Date.now() - student.lastSeen < 30000) ? 'Online' : 'Offline'
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
                  <PlusCircle className="w-8 h-8 text-outline-variant" />
                </div>
                <p className="text-on-surface-variant font-medium">No students have joined yet.</p>
                <p className="text-xs text-outline-variant mt-1">Share the room code to start the session.</p>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      <BottomNavBar />
    </div>
  );
}
