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
    if (!currentStudentRoll || !quiz) {
      const timer = setTimeout(() => navigate('/join'), 2000);
      return () => clearTimeout(timer);
    }
    setLoading(false);
  }, [currentStudentRoll, quiz, navigate]);

  if (loading || !participant || !quiz) return <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6"><Loader2 className="w-10 h-10 animate-spin text-primary mb-4" /><p className="text-on-surface-variant">Loading results...</p></div>;

  const handleQuerySubmit = async () => {
    if (!queryText.trim() || !currentStudentRoll) return;
    setQuerySubmitting(true);
    try {
      await updateParticipant(currentStudentRoll, { query: queryText.trim() });
      setQuerySubmitted(true);
      setIsQuerying(false);
    } catch (err) { console.error("Failed to submit query:", err); } finally { setQuerySubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopAppBar variant="standard" />
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-emerald-600" /></div>
            <h1 className="text-3xl font-headline font-extrabold text-on-surface">Quiz Submitted!</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 text-center shadow-sm">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Your Score</p>
              <p className="text-3xl font-black text-primary">{Math.floor((participant.score || 0) * 100) / 100}</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 text-center shadow-sm">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Time Taken</p>
              <p className="text-2xl font-black text-on-surface">{Math.floor((participant.timeTaken || 0) / 60)}m {(participant.timeTaken || 0) % 60}s</p>
            </div>
          </div>

          <div className="space-y-4 pt-8">
            {!querySubmitted ? (
              !isQuerying ? (
                <button onClick={() => setIsQuerying(true)} className="w-full py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl flex items-center justify-center gap-3"><MessageSquare className="w-5 h-5" /> Ask Query to Teacher</button>
              ) : (
                <div className="space-y-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10">
                  <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Write your query here..." className="w-full h-32 p-4 bg-surface-container-lowest border rounded-2xl outline-none resize-none text-sm" />
                  <div className="flex gap-3">
                    <button onClick={() => setIsQuerying(false)} className="flex-1 py-3 bg-surface-container-high font-bold rounded-xl">Cancel</button>
                    <button onClick={handleQuerySubmit} disabled={querySubmitting || !queryText.trim()} className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2">{querySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Query"}</button>
                  </div>
                </div>
              )
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 font-bold"><CheckCircle2 className="w-5 h-5" /> Query submitted successfully!</div>
            )}
            <button onClick={() => { resetQuiz(); navigate('/join'); }} className="w-full py-4 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-primary/20">Exit Quiz</button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
