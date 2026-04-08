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
              questions = questionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Question[];
            }
            qMap[quiz.id] = questions;

            const responsesRef = collection(db, 'quizzes', quiz.id, 'responses');
            const snapshot = await getDocs(responsesRef);
            snapshot.docs.forEach(doc => {
              participantsList.push({ id: doc.id, ...doc.data() } as Participant);
            });
          }
        }
        
        setAllParticipants(participantsList);
        setQuizQuestionsMap(qMap);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'responses');
      } finally {
        setLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, [user, quizzes]);

  const getParticipantPercentage = (participant: Participant, quiz: Quiz) => {
    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];
    if (questions.length === 0) return 0;
    
    const rawScore = getRawScore(participant, quiz, questions);
    return Math.round((rawScore / questions.length) * 100);
  };

  const getQuizStats = (quiz: Quiz) => {
    const participants = allParticipants.filter(p => p.quizId === quiz.id);
    const submitted = participants.filter(p => p.status === 'Submitted');
    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];
    
    let totalRawScore = 0;
    let maxRawScore = 0;
    let minRawScore = submitted.length > 0 ? questions.length : 0;

    submitted.forEach(p => {
      const rawScore = getRawScore(p, quiz, questions);
      totalRawScore += rawScore;
      if (rawScore > maxRawScore) maxRawScore = rawScore;
      if (rawScore < minRawScore) minRawScore = rawScore;
    });

    const avgRawScore = submitted.length > 0 ? Math.round((totalRawScore / submitted.length) * 100) / 100 : 0;
    const avgPercentage = questions.length > 0 ? Math.round((avgRawScore / questions.length) * 100) : 0;
    
    return {
      count: participants.length,
      avgRawScore,
      avgPercentage,
      maxRawScore,
      minRawScore: submitted.length > 0 ? minRawScore : 0,
      totalQuestions: questions.length
    };
  };

  const handleExportData = (quiz: Quiz) => {
    const quizId = quiz.id;
    if (!quizId) return;

    const participants = allParticipants.filter(p => p.quizId === quizId);
    const questions = quizQuestionsMap[quizId] || quiz.questions || [];
    const stats = getQuizStats(quiz);

    const studentData = participants.map(p => {
      const rawScore = getRawScore(p, quiz, questions);
      const responses: Record<string, any> = {};
      questions.forEach((q, idx) => {
        const key = `Q${idx + 1}: ${q.text}`;
        const answer = p.answers[q.id];
        if (!answer) {
          responses[key] = "No Answer";
        } else if (q.type === 'Paragraph') {
          responses[key] = answer;
        } else if (Array.isArray(answer)) {
          responses[key] = answer.map(label => `${label}: ${q.options[label] || label}`).join(", ");
        } else {
          responses[key] = `${answer}: ${q.options[answer] || answer}`;
        }
      });
      
      return {
        Name: p.name,
        RollNumber: p.roll,
        MarksScored: `${rawScore}/${questions.length}`,
        Status: p.status,
        TimeTaken: p.timeTaken ? `${p.timeTaken}s` : 'N/A',
        Query: p.query || "None",
        Responses: responses
      };
    });

    const studentBlob = new Blob([JSON.stringify(studentData, null, 2)], { type: 'application/json' });
    const studentUrl = URL.createObjectURL(studentBlob);
    const studentLink = document.createElement('a');
    studentLink.href = studentUrl;
    studentLink.download = `Student_Report_${quiz.title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(studentLink);
    studentLink.click();
    document.body.removeChild(studentLink);

    // Quiz Metadata Export
    const metadata = {
      QuizTitle: quiz.title,
      RoomCode: quiz.roomCode,
      TotalQuestions: quiz.totalQuestions,
      TotalStudentsAttended: stats.count,
      TopperMarks: `${stats.maxRawScore}/${questions.length}`,
      AverageScore: `${stats.avgRawScore}/${questions.length}`,
      Questions: questions.map((q, idx) => ({
        Number: idx + 1,
        Text: q.text,
        Type: q.type,
        Options: q.options,
        CorrectAnswer: q.type === 'Paragraph' ? "Manual Grading" : (
          Array.isArray(q.correctOption) 
            ? q.correctOption.map(label => `${label}: ${q.options[label] || label}`).join(", ") 
            : `${q.correctOption}: ${q.options[q.correctOption] || q.correctOption}`
        )
      }))
    };

    const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metaUrl = URL.createObjectURL(metaBlob);
    const metaLink = document.createElement('a');
    metaLink.href = metaUrl;
    metaLink.download = `Quiz_Metadata_${quiz.title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(metaLink);
    metaLink.click();
    document.body.removeChild(metaLink);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    await deleteQuiz(quizId);
    setShowDeleteConfirm(null);
    setSelectedQuiz(null);
  };

  if (quizLoading || loadingParticipants) {
    return (
      <div className="bg-surface min-h-screen pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen pb-24 flex flex-col">
      <TopAppBar />
      
      <main className="flex-grow p-6 md:p-12 max-w-7xl mx-auto w-full">
        {selectedQuiz ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <button onClick={() => setSelectedQuiz(null)} className="flex items-center gap-2 text-primary font-bold hover:underline mb-4">
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to All Reports
            </button>

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-2">{selectedQuiz.title}</h1>
                <p className="text-on-surface-variant font-body text-lg">Detailed performance analysis for room code <span className="font-mono font-bold text-primary">{selectedQuiz.roomCode}</span></p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => handleExportData(selectedQuiz)} disabled={selectedQuiz.isActive} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                    <Download className="w-4 h-4" />
                    Export Data
                  </button>
                  <button onClick={() => setShowDeleteConfirm(selectedQuiz.id || null)} disabled={selectedQuiz.isActive} className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-xl font-bold text-sm hover:bg-error/20 transition-all disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                    Delete Quiz
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">Average Score</p>
                  <p className="text-3xl font-headline font-black text-primary">{getQuizStats(selectedQuiz).avgRawScore}<span className="text-sm text-on-surface-variant/50 ml-1">/{selectedQuiz.totalQuestions}</span></p>
                </div>
                <div className="w-px h-12 bg-outline-variant/30 mx-2"></div>
                <div className="text-right">
                  <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">Participants</p>
                  <p className="text-3xl font-headline font-black text-on-surface">{getQuizStats(selectedQuiz).count}</p>
                </div>
              </div>
            </header>

            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
                <h2 className="font-headline font-bold text-xl text-on-surface">Student Performance</h2>
                <button onClick={() => setShowQueriesOnly(!showQueriesOnly)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all", showQueriesOnly ? "bg-error text-white shadow-lg shadow-error/20" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high")}>
                  <MessageSquare className="w-4 h-4" />
                  {showQueriesOnly ? "Showing Queries" : "Filter Queries"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Rank</th>
                      <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Student</th>
                      <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Roll Number</th>
                      <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Score</th>
                      <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {allParticipants
                      .filter(p => p.quizId === selectedQuiz.id)
                      .filter(p => !showQueriesOnly || (p.query && p.query.trim().length > 0))
                      .sort((a, b) => getParticipantPercentage(b, selectedQuiz) - getParticipantPercentage(a, selectedQuiz))
                      .map((p, index) => (
                        <tr key={p.id} onClick={() => setViewingSubmission(p)} className="hover:bg-surface-container-low/30 transition-colors cursor-pointer">
                          <td className="px-6 py-5">
                            <span className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm", index === 0 ? "bg-amber-500 text-white" : "bg-surface-container-low text-on-surface-variant")}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <span className="font-headline font-bold text-on-surface">{p.name}</span>
                              {p.query && <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-on-surface-variant">{p.roll}</td>
                          <td className="px-6 py-5 font-headline font-black text-primary">{getParticipantPercentage(p, selectedQuiz)}%</td>
                          <td className="px-6 py-5">
                            <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", p.status === 'Submitted' ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary")}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <AnimatePresence>
              {viewingSubmission && selectedQuiz && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-surface rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30">
                      <div>
                        <h3 className="font-headline font-bold text-2xl">Submission Details</h3>
                        <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mt-1">Student: {viewingSubmission.name} | Roll: {viewingSubmission.roll}</p>
                      </div>
                      <button onClick={() => setViewingSubmission(null)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors"><Filter className="w-5 h-5 rotate-45" /></button>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-8 space-y-8">
                      {viewingSubmission.query && (
                        <div className="p-6 bg-error/5 border border-error/10 rounded-3xl space-y-3">
                          <div className="flex items-center gap-2 text-error"><MessageSquare className="w-5 h-5" /><h4 className="font-headline font-bold">Student Query</h4></div>
                          <p className="text-on-surface font-body leading-relaxed italic">"{viewingSubmission.query}"</p>
                        </div>
                      )}

                      {(quizQuestionsMap[selectedQuiz.id!] || selectedQuiz.questions).map((q, idx) => {
                        const studentAnswer = viewingSubmission.answers[q.id];
                        return (
                          <div key={q.id} className="space-y-4 pb-8 border-b border-outline-variant/10 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-3">
                                <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center font-bold text-sm flex-shrink-0">{idx + 1}</span>
                                <div><p className="font-headline font-bold text-on-surface text-lg">{q.text}</p><span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{q.type}</span></div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Student's Answer</p>
                                <p className="font-medium leading-relaxed">
                                  {q.type === 'Paragraph' 
                                    ? (studentAnswer || "No Answer")
                                    : Array.isArray(studentAnswer) 
                                      ? studentAnswer.map(label => `${label}: ${q.options[label] || label}`).join(", ") 
                                      : studentAnswer ? `${studentAnswer}: ${q.options[studentAnswer] || studentAnswer}` : "No Answer"
                                  }
                                </p>
                              </div>
                              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Correct Answer</p>
                                <p className="font-medium">
                                  {q.type === 'Paragraph'
                                    ? "Manual Grading Required"
                                    : Array.isArray(q.correctOption) 
                                      ? q.correctOption.map(label => `${label}: ${q.options[label] || label}`).join(", ") 
                                      : `${q.correctOption}: ${q.options[q.correctOption] || q.correctOption}`
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/30 flex justify-end">
                      <button onClick={() => setViewingSubmission(null)} className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">Close</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase())).map((quiz) => (
              <div key={quiz.id} onClick={() => setSelectedQuiz(quiz)} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm hover:shadow-md cursor-pointer transition-all">
                <h3 className="font-headline font-bold text-xl mb-2">{quiz.title}</h3>
                <p className="text-sm text-on-surface-variant font-mono">{quiz.roomCode}</p>
                <div className="mt-4 flex justify-between items-end">
                  <span className="text-xs font-bold text-primary uppercase">View Report</span>
                  <span className="text-xs text-on-surface-variant">{getQuizStats(quiz).count} Students</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNavBar />
    </div>
  );
}
