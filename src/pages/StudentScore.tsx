import React, { useEffect, useState } from 'react';
import { useQuiz } from '@/src/context/QuizContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, Trophy, Clock, LogOut, MessageSquare, Loader2, Info } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import TopAppBar from '@/src/components/TopAppBar';

export default function StudentScore() {
  const { quiz, currentStudentRoll, participants, resetQuiz, updateParticipant } = useQuiz();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [querySubmitting, setQuerySubmitting] = useState(false);
  const [querySubmitted, setQuerySubmitted] = useState(false);

  const participant = participants.find(p => p.roll === currentStudentRoll);
  
  useEffect(() => {
    // If no quiz or no student roll, redirect to join
    if (!currentStudentRoll || !quiz) {
      const timer = setTimeout(() => {
        navigate('/join');
      }, 2000);
      return () => clearTimeout(timer);
    }
    setLoading(false);
  }, [currentStudentRoll, quiz, navigate]);

  if (loading || !participant || !quiz) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-on-surface-variant font-headline">Loading your results...</p>
      </div>
    );
  }

  const truncateScore = (score: number) => Math.floor(score * 100) / 100;

  const participantQuestions = participant.questionOrder 
    ? quiz.questions.filter(q => participant.questionOrder!.includes(q.id))
    : quiz.questions;
  const scorableQuestions = participantQuestions.filter(q => q.type !== 'Paragraph');
  const totalScorable = scorableQuestions.length;
  const hasParagraphs = participantQuestions.some(q => q.type === 'Paragraph');

  const topperScore = truncateScore(Math.max(...participants.map(p => p.score || 0), 0));
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleQuerySubmit = async () => {
    if (!queryText.trim() || !currentStudentRoll) return;
    setQuerySubmitting(true);
    try {
      await updateParticipant(currentStudentRoll, { query: queryText.trim() });
      setQuerySubmitted(true);
      setIsQuerying(false);
    } catch (err) {
      console.error("Failed to submit query:", err);
    } finally {
      setQuerySubmitting(false);
    }
  };

  const handleExit = () => {
    resetQuiz();
    navigate('/join');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopAppBar variant="standard" />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-8"
        >
          {/* Success Header */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-headline font-extrabold text-on-surface">
              Quiz Submitted!
            </h1>
            <p className="text-on-surface-variant">
              Your quiz response was submitted successfully.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Your Score */}
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 text-center space-y-2 shadow-sm">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Your Score</p>
              <p className="text-3xl font-headline font-black text-primary">
                {truncateScore(participant.score ?? 0)}<span className="text-lg text-on-surface-variant/50 ml-1">/{totalScorable}</span>
              </p>
            </div>

            {/* Time Taken */}
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 text-center space-y-2 shadow-sm">
              <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Time Taken</p>
              <p className="text-2xl font-headline font-black text-on-surface">
                {formatTime(participant.timeTaken || 0)}
              </p>
            </div>

            {/* Topper Marks */}
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 text-center space-y-2 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Topper Marks</p>
              <p className="text-3xl font-headline font-black text-amber-600">
                {topperScore}<span className="text-lg text-on-surface-variant/50 ml-1">/{totalScorable}</span>
              </p>
            </div>
          </div>

          {/* Paragraph Warning */}
          {hasParagraphs && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/5 border border-primary/10 p-6 rounded-3xl flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-on-surface">Manual Evaluation Required</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  This quiz contains paragraph-type questions. These are not included in your current score. Please ask your teacher to evaluate your paragraph answers for your final grade.
                </p>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="space-y-4 pt-8">
            {!querySubmitted ? (
              <>
                {!isQuerying ? (
                  <button
                    onClick={() => setIsQuerying(true)}
                    className="w-full py-4 px-6 rounded-2xl bg-surface-container-high text-on-surface font-headline font-bold flex items-center justify-center gap-3 hover:bg-surface-container-highest transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Ask Query to Teacher
                  </button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      <h4 className="font-headline font-bold text-on-surface">Submit a Query</h4>
                    </div>
                    <textarea 
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      placeholder="Write your query here... (e.g., 'I think Q4 had a mistake')"
                      className="w-full h-32 p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none text-sm font-body"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsQuerying(false)}
                        className="flex-1 py-3 bg-surface-container-high text-on-surface font-bold rounded-xl hover:bg-surface-container-highest transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleQuerySubmit}
                        disabled={querySubmitting || !queryText.trim()}
                        className="flex-[2] py-3 bg-primary text-on-primary font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {querySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Query"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 font-bold"
              >
                <CheckCircle2 className="w-5 h-5" />
                Query submitted to teacher successfully!
              </motion.div>
            )}
            
            <button
              onClick={handleExit}
              className="w-full py-4 px-6 rounded-2xl bg-primary text-on-primary font-headline font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Exit Quiz
            </button>
          </div>

          <p className="text-center text-xs text-on-surface-variant pt-4">
            You can now leave the quiz room.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
