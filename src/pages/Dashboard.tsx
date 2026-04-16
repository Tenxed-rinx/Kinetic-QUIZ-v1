import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { Copy, Filter, Download, PlusCircle, Radio, Search, ArrowRight, Award, Info, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useQuiz } from "@/src/context/QuizContext";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function Dashboard() {
  const { quiz, participants, loading, endQuiz } = useQuiz();
  const { profile } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const navigate = useNavigate();

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

  if (loading) {
    return (
      <div className="bg-surface min-h-screen pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isStudent = profile?.role === 'Student';

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

  // Ensure quiz is still active for the teacher to see the controls
  if (quiz && !quiz.isActive && profile?.role !== 'Student') {
    // If the quiz just ended, the teacher should see a link to reports
    return (
      <div className="bg-surface min-h-screen pb-24">
        <TopAppBar />
        <main className="max-w-screen-2xl mx-auto px-6 pt-20 flex flex-col items-center justify-center text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-container-lowest p-12 rounded-3xl shadow-sm border border-surface-container max-w-lg w-full"
          >
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="font-headline text-3xl font-extrabold mb-4">Quiz Session Ended</h2>
            <p className="text-on-surface-variant mb-8">This quiz session has been completed. You can view the full performance reports now.</p>
            <Link 
              to="/reports"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              View Reports
            </Link>
          </motion.div>
        </main>
        <BottomNavBar />
      </div>
    );
  }

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
            </div>
            {window.location.hostname.includes('ais-dev') && (
              <p className="mt-2 text-[9px] text-emerald-600 font-medium flex items-center gap-1">
                <Info className="w-2.5 h-2.5" />
                Note: You are on a private dev link. The "Copy Link" button will automatically use the public "ais-pre" URL for your students.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowEndConfirm(true)}
              className="px-6 h-14 rounded-2xl bg-error/10 text-error font-headline font-bold hover:bg-error/20 transition-colors flex items-center justify-center gap-2"
            >
              End Quiz
            </button>
          </div>
        </motion.div>

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
