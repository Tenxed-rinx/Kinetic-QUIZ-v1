import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { BarChart3, Users, Clock, Award, ChevronRight, Search, Filter, ClipboardList, Trash2, Download, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useQuiz, Participant, Quiz, Question } from "@/src/context/QuizContext";
import { cn } from "@/src/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Reports() {
  const { quizzes, calculateScore: getRawScore, loading: quizLoading, deleteQuiz, gradeParticipant } = useQuiz();
  const { user } = useAuth();
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [quizQuestionsMap, setQuizQuestionsMap] = useState<Record<string, Question[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [gradingParticipant, setGradingParticipant] = useState<Participant | null>(null);
  const [gradingValues, setGradingValues] = useState<Record<string, number>>({});
  const [viewingSubmission, setViewingSubmission] = useState<Participant | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showQueriesOnly, setShowQueriesOnly] = useState(false);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!user || quizzes.length === 0) return;
      setLoadingParticipants(true);
      try {
        const participantsList: Participant[] = [];
        const qMap: Record<string, Question[]> = {};
        for (const quiz of quizzes) {
          if (quiz.id) {
            let questions = quiz.questions || [];
            if (questions.length === 0) {
              const questionsRef = collection(db, 'quizzes', quiz.id, 'questions');
              const questionsSnapshot = await getDocs(questionsRef);
              questions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Question[];
            }
            qMap[quiz.id] = questions;
            const responsesRef = collection(db, 'quizzes', quiz.id, 'responses');
            const snapshot = await getDocs(responsesRef);
            snapshot.docs.forEach(doc => { participantsList.push({ id: doc.id, ...doc.data() } as Participant); });
          }
        }
        setAllParticipants(participantsList);
        setQuizQuestionsMap(qMap);
      } catch (err) { handleFirestoreError(err, OperationType.LIST, 'responses'); } finally { setLoadingParticipants(false); }
    };
    fetchParticipants();
  }, [user, quizzes]);

  const getParticipantPercentage = (participant: Participant, quiz: Quiz) => {
    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];
    if (questions.length === 0) return 0;
    const rawScore = getRawScore(participant, quiz, questions);
    return Math.round((rawScore / questions.length) * 100);
  };

  const stats = useMemo(() => {
    const totalParticipants = allParticipants.length;
    let totalScore = 0;
    let scoredParticipants = 0;
    allParticipants.forEach(p => {
      const quiz = quizzes.find(q => q.id === p.quizId);
      if (quiz && p.status === 'Submitted') { totalScore += getParticipantPercentage(p, quiz); scoredParticipants++; }
    });
    const avgScore = scoredParticipants > 0 ? Math.round(totalScore / scoredParticipants) : 0;
    return { totalQuizzes: quizzes.length, totalParticipants, avgScore: `${avgScore}%`, avgTime: "N/A" };
  }, [quizzes, allParticipants, quizQuestionsMap]);

  const filteredQuizzes = useMemo(() => quizzes.filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase())), [quizzes, searchQuery]);

  const getQuizStats = (quiz: Quiz) => {
    const participants = allParticipants.filter(p => p.quizId === quiz.id);
    const submitted = participants.filter(p => p.status === 'Submitted');
    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];
    let totalRawScore = 0;
    let maxRawScore = 0;
    submitted.forEach(p => {
      const rawScore = getRawScore(p, quiz, questions);
      totalRawScore += rawScore;
      if (rawScore > maxRawScore) maxRawScore = rawScore;
    });
    const avgRawScore = submitted.length > 0 ? Math.round((totalRawScore / submitted.length) * 100) / 100 : 0;
    const avgPercentage = questions.length > 0 ? Math.round((avgRawScore / questions.length) * 100) : 0;
    return { count: participants.length, avgRawScore, avgPercentage, maxRawScore, totalQuestions: questions.length };
  };

  if (quizLoading || loadingParticipants) return <div className="bg-surface min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div></div>;

  return (
    <div className="bg-surface min-h-screen pb-24 flex flex-col">
      <TopAppBar />
      <main className="flex-grow p-6 md:p-12 max-w-7xl mx-auto w-full">
        {selectedQuiz ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <button onClick={() => setSelectedQuiz(null)} className="flex items-center gap-2 text-primary font-bold hover:underline mb-4"><ChevronRight className="w-4 h-4 rotate-180" /> Back</button>
            <header className="flex flex-col md:flex-row justify-between gap-6">
              <div><h1 className="font-headline text-4xl font-extrabold text-on-surface mb-2">{selectedQuiz.title}</h1><p className="text-on-surface-variant">Room Code: <span className="font-mono font-bold text-primary">{selectedQuiz.roomCode}</span></p></div>
              <div className="flex items-center gap-4">
                <div className="text-right"><p className="text-xs font-bold uppercase text-on-surface-variant">Avg Score</p><p className="text-3xl font-black text-primary">{getQuizStats(selectedQuiz).avgRawScore}/{selectedQuiz.totalQuestions}</p></div>
                <div className="text-right"><p className="text-xs font-bold uppercase text-on-surface-variant">Participants</p><p className="text-3xl font-black text-on-surface">{getQuizStats(selectedQuiz).count}</p></div>
              </div>
            </header>

            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
                <h2 className="font-headline font-bold text-xl text-on-surface">Student Performance</h2>
                <button onClick={() => setShowQueriesOnly(!showQueriesOnly)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all", showQueriesOnly ? "bg-error text-white" : "bg-surface-container-low text-on-surface-variant")}>
                  <MessageSquare className="w-4 h-4" /> {showQueriesOnly ? "Showing Queries" : "Filter Queries"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="bg-surface-container-low/50"><th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant">Student</th><th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant">Roll</th><th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant">Score</th><th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant">Status</th></tr></thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {allParticipants.filter(p => p.quizId === selectedQuiz.id).filter(p => !showQueriesOnly || (p.query && p.query.trim().length > 0)).map((p) => (
                      <tr key={p.id} onClick={() => setViewingSubmission(p)} className="hover:bg-surface-container-low/30 cursor-pointer">
                        <td className="px-6 py-5 flex items-center gap-2"><span className="font-bold">{p.name}</span>{p.query && <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>}</td>
                        <td className="px-6 py-5 text-on-surface-variant">{p.roll}</td>
                        <td className="px-6 py-5 font-black text-primary">{getParticipantPercentage(p, selectedQuiz)}%</td>
                        <td className="px-6 py-5"><span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", p.status === 'Submitted' ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary")}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map(quiz => (
              <div key={quiz.id} onClick={() => setSelectedQuiz(quiz)} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm hover:shadow-md cursor-pointer transition-all">
                <h3 className="font-headline font-bold text-xl mb-2">{quiz.title}</h3>
                <p className="text-sm text-on-surface-variant mb-4">Code: {quiz.roomCode}</p>
                <div className="flex justify-between items-end"><div className="text-xs font-bold text-primary uppercase">View Report</div><div className="text-xs text-on-surface-variant">{getQuizStats(quiz).count} Students</div></div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNavBar />
      
      {/* View Submission Modal */}
      <AnimatePresence>
        {viewingSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8">
              <h3 className="text-2xl font-bold mb-4">{viewingSubmission.name}'s Submission</h3>
              {viewingSubmission.query && <div className="p-4 bg-error/5 border border-error/10 rounded-2xl mb-6"><p className="text-error font-bold text-sm mb-1">Student Query:</p><p className="italic">"{viewingSubmission.query}"</p></div>}
              <div className="space-y-6">
                {(quizQuestionsMap[selectedQuiz?.id!] || selectedQuiz?.questions).map((q, i) => (
                  <div key={q.id} className="p-4 bg-surface-container-low rounded-2xl">
                    <p className="font-bold mb-2">{i+1}. {q.text}</p>
                    <p className="text-sm"><span className="text-on-surface-variant">Answer:</span> {Array.isArray(viewingSubmission.answers[q.id]) ? viewingSubmission.answers[q.id].join(", ") : (viewingSubmission.answers[q.id] || "No Answer")}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setViewingSubmission(null)} className="w-full mt-8 py-3 bg-primary text-white font-bold rounded-xl">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
