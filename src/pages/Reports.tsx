import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { BarChart3, Users, Clock, Award, ChevronRight, Search, Filter, ClipboardList, Trash2, Download, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useQuiz, Participant, Quiz, Question } from "@/src/context/QuizContext";
import { cn } from "@/src/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Reports() {
  const { quizzes, calculateScore: getRawScore, loading: quizLoading, deleteQuiz } = useQuiz();
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
  const { gradeParticipant } = useQuiz();

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!user || quizzes.length === 0) return;
      
      setLoadingParticipants(true);
      try {
        const participantsList: Participant[] = [];
        // Use a map to store questions to avoid mutating context objects directly
        const quizQuestionsMap: Record<string, Question[]> = {};

        for (const quiz of quizzes) {
          if (quiz.id) {
            // Fetch questions if missing or not in map
            let questions = quiz.questions || [];
            if (questions.length === 0) {
              const questionsRef = collection(db, 'quizzes', quiz.id, 'questions');
              const questionsSnapshot = await getDocs(questionsRef);
              questions = questionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Question[];
            }
            quizQuestionsMap[quiz.id] = questions;

            const responsesRef = collection(db, 'quizzes', quiz.id, 'responses');
            const snapshot = await getDocs(responsesRef);
            snapshot.docs.forEach(doc => {
              participantsList.push({ id: doc.id, ...doc.data() } as Participant);
            });
          }
        }
        
        setAllParticipants(participantsList);
        setQuizQuestionsMap(quizQuestionsMap);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'responses');
      } finally {
        setLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, [user, quizzes]);

  const getQuizStats = useCallback((quiz: Quiz) => {
    const participants = allParticipants.filter(p => p.quizId === quiz.id);
    const submitted = participants.filter(p => p.status === 'Submitted');
    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];
    
    let totalCorrectAnswers = 0;
    let totalGradableAttempted = 0;
    let maxRawScore = 0;
    let minRawScore = submitted.length > 0 ? -1 : 0;

    submitted.forEach(p => {
      // getRawScore returns total correct answers (excluding paragraph type)
      const rawScore = getRawScore(p, quiz, questions);
      totalCorrectAnswers += rawScore;
      
      // Calculate how many gradable questions were actually shown to this student
      const studentQuestions = p.questionOrder 
        ? questions.filter(q => p.questionOrder?.includes(q.id))
        : questions;
      const gradableCount = studentQuestions.filter(q => q.type !== 'Paragraph').length;
      totalGradableAttempted += gradableCount;

      if (rawScore > maxRawScore) maxRawScore = rawScore;
      if (minRawScore === -1 || rawScore < minRawScore) minRawScore = rawScore;
    });

    // Average Score (%) = (total correct from all students) / (total questions × total students) × 100
    // Note: total questions × total students is equivalent to totalGradableAttempted
    let totalPercentage = 0;

submitted.forEach(p => {
  const rawScore = getRawScore(p, quiz, questions);

  const studentQuestions = p.questionOrder 
    ? questions.filter(q => p.questionOrder?.includes(q.id))
    : questions;

  const gradableCount = studentQuestions.filter(q => q.type !== 'Paragraph').length;

  const percentage = gradableCount > 0 
    ? (rawScore / gradableCount) * 100 
    : 0;

  totalPercentage += percentage;
});

const avgPercentage = submitted.length > 0 
  ? totalPercentage / submitted.length 
  : 0;
    const avgRawScore = submitted.length > 0 ? Math.round((totalCorrectAnswers / submitted.length) * 100) / 100 : 0;
    const displayTotalQuestions = submitted.length > 0 
      ? Math.round(totalGradableAttempted / submitted.length) 
      : (quiz.drawCount || questions.filter(q => q.type !== 'Paragraph').length);
    
    return {
      count: participants.length,
      avgRawScore,
      avgPercentage,
      maxRawScore,
      minRawScore: minRawScore === -1 ? 0 : minRawScore,
      totalQuestions: displayTotalQuestions,
      date: quiz.createdAt ? (quiz.createdAt.toDate ? quiz.createdAt.toDate().toLocaleDateString() : new Date(quiz.createdAt).toLocaleDateString()) : 'N/A'
    };
  }, [allParticipants, quizQuestionsMap, getRawScore]);

  const getParticipantPercentage = useCallback((participant: Participant, quiz: Quiz) => {
    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];
    if (questions.length === 0) return 0;
    
    const rawScore = getRawScore(participant, quiz, questions);
    
    const studentQuestions = participant.questionOrder 
      ? questions.filter(q => participant.questionOrder?.includes(q.id))
      : questions;
    const gradableCount = studentQuestions.filter(q => q.type !== 'Paragraph').length;
    
    if (gradableCount === 0) return 0;
    return Math.round((rawScore / gradableCount) * 100);
  }, [quizQuestionsMap, getRawScore]);

  const stats = useMemo(() => {
  let totalCorrect = 0;
  let totalQuestionsAttempted = 0;

  quizzes.forEach(quiz => {
    const participants = allParticipants.filter(
      p => p.quizId === quiz.id && p.status === 'Submitted'
    );

    const questions = quizQuestionsMap[quiz.id || ''] || quiz.questions || [];

    participants.forEach(p => {
      const rawScore = getRawScore(p, quiz, questions);

      const studentQuestions = p.questionOrder 
        ? questions.filter(q => p.questionOrder?.includes(q.id))
        : questions;

      const gradableCount = studentQuestions.filter(q => q.type !== 'Paragraph').length;

      totalCorrect += rawScore;
      totalQuestionsAttempted += gradableCount;
    });
  });

  const avgScore = totalQuestionsAttempted > 0
    ? Math.round((totalCorrect / totalQuestionsAttempted) * 100)
    : 0;

  return {
    totalQuizzes: quizzes.length,
    totalParticipants: allParticipants.length,
    avgScore: `${avgScore}%`,
  };
}, [quizzes, allParticipants, quizQuestionsMap, getRawScore]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [quizzes, searchQuery]);

  const handleExportData = (quiz: Quiz) => {
    const quizId = quiz.id;
    if (!quizId) return;

    const participants = allParticipants.filter(p => p.quizId === quizId);
    const questions = quizQuestionsMap[quizId] || quiz.questions || [];
    const stats = getQuizStats(quiz);

    // 1. Student Details Export (JSON)
    const studentData = participants.map(p => {
      const rawScore = getRawScore(p, quiz, questions);
      const responses: Record<string, any> = {};
      questions.forEach((q, idx) => {
        const key = `Q${idx + 1}: ${q.text}`;
        const answer = p.answers[q.id];
        const optionOrder = p.optionOrders?.[q.id] || ['A', 'B', 'C', 'D'];
        const getVisualLabel = (label: string) => {
          const vIdx = optionOrder.indexOf(label);
          return vIdx !== -1 ? String.fromCharCode(65 + vIdx) : label;
        };

        if (!answer) {
          responses[key] = "No Answer";
        } else if (q.type === 'Paragraph') {
          responses[key] = answer;
        } else if (Array.isArray(answer)) {
          responses[key] = answer.map(label => {
            const visual = getVisualLabel(label);
            const optionText = q.options?.[label] || label;
            return `${visual}: ${optionText}`;
          }).join(", ");
        } else {
          const visual = getVisualLabel(answer);
          const optionText = q.options?.[answer] || answer;
          responses[key] = `${visual}: ${optionText}`;
        }
      });
      
      return {
        Name: p.name,
        RollNumber: p.roll,
        MarksScored: `${rawScore}/${p.questionOrder?.length || questions.length}`,
        Status: p.status,
        TimeTaken: p.timeTaken ? `${p.timeTaken}s` : 'N/A',
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

    // 2. Quiz Metadata Export (JSON)
    const metadata = {
      QuizTitle: quiz.title,
      RoomCode: quiz.roomCode,
      TotalQuestions: stats.totalQuestions,
      TotalStudentsAttended: stats.count,
      TopperMarks: `${stats.maxRawScore}/${stats.totalQuestions}`,
      LowestMarks: `${stats.minRawScore}/${stats.totalQuestions}`,
      AverageScore: `${stats.avgRawScore}/${stats.totalQuestions}`,
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
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <button 
              onClick={() => setSelectedQuiz(null)}
              className="flex items-center gap-2 text-primary font-bold hover:underline mb-4"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to All Reports
            </button>

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-2">{selectedQuiz.title}</h1>
                <p className="text-on-surface-variant font-body text-lg">Detailed performance analysis for room code <span className="font-mono font-bold text-primary">{selectedQuiz.roomCode}</span></p>
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => handleExportData(selectedQuiz)}
                    disabled={selectedQuiz.isActive}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <Download className="w-4 h-4" />
                    Export Data
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(selectedQuiz.id || null)}
                    disabled={selectedQuiz.isActive}
                    className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-xl font-bold text-sm hover:bg-error/20 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Quiz
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">Average Score</p>
                  <p className="text-3xl font-headline font-black text-primary">
                    {getQuizStats(selectedQuiz).avgRawScore}
                    <span className="text-sm text-on-surface-variant/50 ml-1">/{getQuizStats(selectedQuiz).totalQuestions}</span>
                  </p>
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
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowQueriesOnly(!showQueriesOnly)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                      showQueriesOnly ? "bg-error text-white shadow-lg shadow-error/20" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                    {showQueriesOnly ? "Showing Queries" : "Filter Queries"}
                  </button>
                </div>
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
                      .map((p, index) => {
                        const score = getParticipantPercentage(p, selectedQuiz);
                        return (
                          <tr 
                            key={p.id} 
                            onClick={() => setViewingSubmission(p)}
                            className="hover:bg-surface-container-low/30 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-5">
                              <span className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                index === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : 
                                index === 1 ? "bg-slate-300 text-slate-700" : 
                                index === 2 ? "bg-amber-700/20 text-amber-900" : "bg-surface-container-low text-on-surface-variant"
                              )}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <span className="font-headline font-bold text-on-surface">{p.name}</span>
                                {p.query && p.query.trim().length > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-error animate-pulse shadow-sm shadow-error/50" title="Student has a query"></div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5 font-body text-on-surface-variant">{p.roll}</td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
                                  <div className={cn(
                                    "h-full rounded-full",
                                    score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-error"
                                  )} style={{ width: `${score}%` }}></div>
                                </div>
                                <div className="flex flex-col">
                                  <span className={cn(
                                    "font-headline font-black leading-none",
                                    score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-error"
                                  )}>{score}%</span>
                                  <span className="text-[10px] text-on-surface-variant font-bold">
                                    {getRawScore(p, selectedQuiz, quizQuestionsMap[selectedQuiz.id!] || selectedQuiz.questions)}/{p.questionOrder?.length || selectedQuiz.totalQuestions}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                                  p.status === 'Submitted' ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                                )}>
                                  {p.status}
                                </span>
                                {selectedQuiz.questions?.some(q => q.type === 'Paragraph') && p.status === 'Submitted' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGradingParticipant(p);
                                      setGradingValues(p.manualGrades || {});
                                    }}
                                    className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                                    title="Grade Paragraphs"
                                  >
                                    <ClipboardList className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* View Submission Modal */}
            <AnimatePresence>
              {viewingSubmission && selectedQuiz && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                  >
                    <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30">
                      <div>
                        <h3 className="font-headline font-bold text-2xl">Submission Details</h3>
                        <div className="flex gap-4 mt-1">
                          <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Student: {viewingSubmission.name}</p>
                          <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Roll: {viewingSubmission.roll}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setViewingSubmission(null)}
                        className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                      >
                        <Filter className="w-5 h-5 rotate-45" />
                      </button>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-8 space-y-8">
                      {viewingSubmission.query && (
                        <div className="p-6 bg-error/5 border border-error/10 rounded-3xl space-y-3">
                          <div className="flex items-center gap-2 text-error">
                            <MessageSquare className="w-5 h-5" />
                            <h4 className="font-headline font-bold">Student Query</h4>
                          </div>
                          <p className="text-on-surface font-body leading-relaxed italic">
                            "{viewingSubmission.query}"
                          </p>
                        </div>
                      )}

                      {(quizQuestionsMap[selectedQuiz.id!] || selectedQuiz.questions).map((q, idx) => {
                        const studentAnswer = viewingSubmission.answers[q.id];
                        const optionOrder = viewingSubmission.optionOrders?.[q.id] || ['A', 'B', 'C', 'D'];
                        const getVisualLabel = (label: string) => {
                          const vIdx = optionOrder.indexOf(label);
                          return vIdx !== -1 ? String.fromCharCode(65 + vIdx) : label;
                        };

                        const isCorrect = q.type === 'Paragraph' ? null : (
                          q.type === 'Multiple Correct' || q.type === 'MSQ'
                            ? (Array.isArray(studentAnswer) && Array.isArray(q.correctOption) && 
                               studentAnswer.length === q.correctOption.length && 
                               studentAnswer.every(val => q.correctOption.includes(val)))
                            : studentAnswer === q.correctOption
                        );

                        return (
                          <div key={q.id} className="space-y-4 pb-8 border-b border-outline-variant/10 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-3">
                                <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center font-bold text-sm flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="font-headline font-bold text-on-surface text-lg">{q.text}</p>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{q.type}</span>
                                </div>
                              </div>
                              {q.type !== 'Paragraph' && (
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                                  isCorrect ? "bg-emerald-500/10 text-emerald-600" : "bg-error/10 text-error"
                                )}>
                                  {isCorrect ? "Correct" : "Incorrect"}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Student's Answer</p>
                                <p className={cn(
                                  "font-medium leading-relaxed",
                                  q.type === 'Paragraph' ? "whitespace-pre-wrap" : ""
                                )}>
                                  {q.type === 'Paragraph' 
                                    ? (studentAnswer || "No Answer")
                                    : Array.isArray(studentAnswer) 
                                      ? studentAnswer.map(label => `${getVisualLabel(label)}: ${q.options?.[label] || label}`).join(", ") 
                                      : studentAnswer ? `${getVisualLabel(studentAnswer)}: ${q.options?.[studentAnswer] || studentAnswer}` : "No Answer"
                                  }
                                </p>
                              </div>
                              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Correct Answer</p>
                                <p className="font-medium">
                                  {q.type === 'Paragraph'
                                    ? "Manual Grading Required"
                                    : Array.isArray(q.correctOption) 
                                      ? q.correctOption.map(label => `${getVisualLabel(label)}: ${q.options?.[label] || label}`).join(", ") 
                                      : `${getVisualLabel(q.correctOption)}: ${q.options?.[q.correctOption] || q.correctOption}`
                                  }
                                </p>
                              </div>
                            </div>

                            {q.type === 'Paragraph' && viewingSubmission.manualGrades?.[q.id] !== undefined && (
                              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                                <Award className="w-4 h-4" />
                                Graded: {viewingSubmission.manualGrades[q.id] * 100}%
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/30 flex justify-end">
                      <button 
                        onClick={() => setViewingSubmission(null)}
                        className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Grading Modal */}
            {gradingParticipant && selectedQuiz && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                >
                  <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
                    <div>
                      <h3 className="font-headline font-bold text-xl">Grade Responses: {gradingParticipant.name}</h3>
                      <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mt-1">Roll: {gradingParticipant.roll}</p>
                    </div>
                    <button 
                      onClick={() => setGradingParticipant(null)}
                      className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                    >
                      <Filter className="w-5 h-5 rotate-45" />
                    </button>
                  </div>
                  
                  <div className="flex-grow overflow-y-auto p-6 space-y-8">
                    {selectedQuiz.questions?.filter(q => q.type === 'Paragraph').map((q) => (
                      <div key={q.id} className="space-y-4">
                        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
                          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Question</p>
                          <p className="font-medium text-on-surface">{q.text}</p>
                        </div>
                        <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-inner">
                          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Student Answer</p>
                          <p className="font-body text-on-surface leading-relaxed whitespace-pre-wrap">
                            {gradingParticipant.answers[q.id] || "No answer provided."}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-bold text-on-surface-variant">Score (0 to 1):</p>
                          <div className="flex gap-2">
                            {[0, 0.25, 0.5, 0.75, 1].map((val) => (
                              <button
                                key={val}
                                onClick={() => setGradingValues(prev => ({ ...prev, [q.id]: val }))}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                  gradingValues[q.id] === val 
                                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                                )}
                              >
                                {val * 100}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/30 flex justify-end gap-3">
                    <button 
                      onClick={() => setGradingParticipant(null)}
                      className="px-6 py-2.5 font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={async () => {
                        if (selectedQuiz.id && gradingParticipant.id) {
                          await gradeParticipant(selectedQuiz.id, gradingParticipant.id, gradingValues);
                          // Update local state to reflect changes immediately
                          setAllParticipants(prev => prev.map(p => 
                            p.id === gradingParticipant.id ? { ...p, manualGrades: gradingValues } : p
                          ));
                          setGradingParticipant(null);
                        }
                      }}
                      className="px-8 py-2.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Save Grades
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        ) : (
          <>
            <header className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-2">Quiz Reports</h1>
              <p className="text-on-surface-variant font-body text-lg">Analyze student performance and engagement metrics.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input 
                  type="text" 
                  placeholder="Search quizzes..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64"
                />
              </div>
              <button className="p-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition-colors">
                <Filter className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { label: "Total Quizzes", value: stats.totalQuizzes, icon: ClipboardList, color: "bg-blue-500" },
            { label: "Total Participants", value: stats.totalParticipants.toLocaleString(), icon: Users, color: "bg-purple-500" },
            { label: "Avg. Score", value: stats.avgScore, icon: Award, color: "bg-amber-500" },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm flex items-center gap-5"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">{stat.label}</p>
                <p className="text-2xl font-headline font-black text-on-surface">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Reports Table */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
            <h2 className="font-headline font-bold text-xl text-on-surface">Recent Quiz Performance</h2>
            <button className="text-primary font-label font-bold text-sm hover:underline">Export All Data</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Quiz Name</th>
                  <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Room Code</th>
                  <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Participants</th>
                  <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Avg. Score</th>
                  <th className="px-6 py-4 font-label font-bold text-xs uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filteredQuizzes.length > 0 ? filteredQuizzes.map((quiz) => {
                  const qStats = getQuizStats(quiz);
                  return (
                    <tr 
                      key={quiz.id} 
                      onClick={() => setSelectedQuiz(quiz)}
                      className="hover:bg-surface-container-low/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <span className="font-headline font-bold text-on-surface">{quiz.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant font-body text-sm font-mono">{quiz.roomCode}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-outline" />
                          <span className="font-body font-medium text-on-surface">{qStats.count}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="w-full max-w-[100px] h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${qStats.avgPercentage}%` }}></div>
                        </div>
                        <span className="text-xs font-label font-bold text-primary mt-1 block">
                          {qStats.avgRawScore}/{qStats.totalQuestions}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          quiz.isActive ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"
                        )}>
                          {quiz.isActive ? "Active" : "Completed"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportData(quiz);
                            }}
                            disabled={quiz.isActive}
                            className="p-2 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30"
                            title="Export Data"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(quiz.id || null);
                            }}
                            disabled={quiz.isActive}
                            className="p-2 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors disabled:opacity-30"
                            title="Delete Quiz"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg hover:bg-surface-container-high transition-colors group-hover:text-primary">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant font-body italic">
                      {searchQuery ? "No quizzes match your search." : "No quiz reports available yet. Create and share a quiz to see results!"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </main>

      <BottomNavBar />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-lowest p-8 rounded-3xl shadow-2xl border border-surface-container max-w-md w-full"
            >
              <h3 className="font-headline text-2xl font-extrabold mb-4 text-on-surface">Delete Quiz?</h3>
              <p className="text-on-surface-variant mb-8 leading-relaxed">
                Are you sure you want to delete this quiz and all its reports? This action is permanent and cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-surface-container-low text-on-surface font-headline font-bold rounded-xl hover:bg-surface-container transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteQuiz(showDeleteConfirm)}
                  className="flex-1 py-4 bg-error text-on-error font-headline font-bold rounded-xl shadow-lg shadow-error/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
