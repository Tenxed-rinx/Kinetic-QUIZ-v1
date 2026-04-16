import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';

export interface Question {
  id: string;
  type: string;
  timer: number;
  text: string;
  options: Record<string, string>;
  correctOption: string | string[]; // Allow multiple for MSQ
}

export interface Quiz {
  id?: string;
  authorId?: string;
  title: string;
  totalQuestions: number;
  drawCount: number;
  roomCode: string;
  questions: Question[];
  isActive: boolean;
  allowedRollPatterns?: string[]; // e.g. ["2023-IMG-001-061", "2023-IMT-001-090"]
  createdAt?: any;
}

export interface Participant {
  id: string;
  quizId?: string;
  studentId?: string | null;
  name: string;
  roll: string;
  progress: number;
  questionTimers?: Record<string, number>;
  questionExpiries?: Record<string, number>;
  status: 'Appearing' | 'Submitted' | 'Away';
  answers: Record<string, any>;
  manualGrades?: Record<string, number>; // Map of question ID to points (0 to 1)
  questionOrder?: string[];
  optionOrders?: Record<string, string[]>;
  startTime?: number;
  lastSeen?: number;
  timeTaken?: number;
  score?: number;
  violationCount?: number;
  query?: string;
  createdAt?: any;
}

interface QuizContextType {
  quiz: Quiz | null;
  quizzes: Quiz[];
  participants: Participant[];
  currentStudentRoll: string | null;
  draftQuiz: Partial<Quiz> | null;
  createQuiz: (quiz: Quiz) => Promise<void>;
  resetQuiz: () => void;
  saveDraft: (draft: Partial<Quiz>) => void;
  joinQuiz: (participant: Omit<Participant, 'id' | 'progress' | 'status' | 'answers' | 'questionOrder' | 'optionOrders'>, targetQuiz?: Quiz) => Promise<boolean>;
  updateParticipant: (roll: string, updates: Partial<Participant>) => Promise<void>;
  endQuiz: (quizId: string) => Promise<void>;
  findQuizByRoomCode: (code: string) => Promise<Quiz | null>;
  gradeParticipant: (quizId: string, participantId: string, manualGrades: Record<string, number>) => Promise<void>;
  calculateScore: (participant: Participant, quiz: Quiz, overrideQuestions?: Question[], excludeParagraphs?: boolean) => number;
  isRollAllowed: (roll: string, patterns: string[]) => boolean;
  quizEnded: boolean;
  closeQuizEndedMessage: () => void;
  loading: boolean;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export function QuizProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentStudentRoll, setCurrentStudentRoll] = useState<string | null>(() => {
    return localStorage.getItem('currentStudentRoll');
  });
  const [draftQuiz, setDraftQuiz] = useState<Partial<Quiz> | null>(() => {
    const saved = localStorage.getItem('quizDraft');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [quizEnded, setQuizEnded] = useState(false);

  const closeQuizEndedMessage = () => setQuizEnded(false);

  const findQuizByRoomCode = async (code: string): Promise<Quiz | null> => {
    try {
      // Normalize input code (remove all non-alphanumeric characters)
      const normalizedInput = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      
      if (normalizedInput.length < 6) return null;

      const quizzesRef = collection(db, 'quizzes');
      // We query for active quizzes first
      const q = query(quizzesRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);
      
      const foundDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        const storedNormalized = (data.roomCode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return storedNormalized === normalizedInput;
      });
      
      if (foundDoc) {
        const quizData = foundDoc.data() as Quiz;
        const quizId = foundDoc.id;
        
        // Fetch questions
        const questionsRef = collection(db, 'quizzes', quizId, 'questions');
        const questionsSnapshot = await getDocs(questionsRef);
        const questions = questionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Question[];

        const foundQuiz = {
          id: quizId,
          ...quizData,
          questions,
          totalQuestions: quizData.totalQuestions || questions.length,
          drawCount: quizData.drawCount || questions.length
        };
        
        setQuiz(foundQuiz);
        localStorage.setItem('activeRoomCode', foundQuiz.roomCode);
        return foundQuiz;
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'quizzes');
      return null;
    }
  };

  // Fetch all quizzes for the teacher
  useEffect(() => {
    if (!user) {
      setQuizzes([]);
      // Don't clear 'quiz' here, as students might be using it without being logged in
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const quizzesRef = collection(db, 'quizzes');
    const q = query(quizzesRef, where('authorId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribeQuizzes = onSnapshot(q, (snapshot) => {
      const fetchedQuizzes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quiz[];
      setQuizzes(fetchedQuizzes);
      setLoading(false);

      // For teachers, automatically sync the 'quiz' state with the active quiz from Firestore
      const activeQuiz = fetchedQuizzes.find(q => q.isActive);
      if (activeQuiz) {
        setQuiz(prev => {
          if (prev?.id === activeQuiz.id) {
            return { ...activeQuiz, questions: prev.questions || activeQuiz.questions };
          }
          return activeQuiz;
        });
        // We set activeRoomCode but we DON'T use it to clear the quiz if it's authored by us
        localStorage.setItem('activeRoomCode', activeQuiz.roomCode);
      } else {
        // Only clear if we were previously in a teacher-like state (monitoring a quiz) 
        // AND we don't have ANY active quizzes in our list anymore
        // This prevents flickering if the query is still updating
        if (localStorage.getItem('activeRoomCode') && fetchedQuizzes.length > 0) {
          setQuiz(null);
          localStorage.removeItem('activeRoomCode');
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
      setLoading(false);
    });

    return () => unsubscribeQuizzes();
  }, [user]);

  // Restore quiz session for students from localStorage
  useEffect(() => {
    const restoreSession = async () => {
      const savedRoomCode = localStorage.getItem('activeRoomCode');
      if (savedRoomCode && !quiz && !user) {
        await findQuizByRoomCode(savedRoomCode);
      }
    };
    restoreSession();
  }, [user, quiz]);

  // Fetch participants for the active quiz
  useEffect(() => {
    if (!quiz?.id) {
      setParticipants([]);
      return;
    }

    // Fetch questions if missing
    if (!quiz.questions || quiz.questions.length === 0) {
      const fetchQuestions = async () => {
        try {
          const questionsRef = collection(db, 'quizzes', quiz.id!, 'questions');
          const snapshot = await getDocs(questionsRef);
          const questions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Question[];
          setQuiz(prev => prev ? { ...prev, questions } : null);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, `quizzes/${quiz.id}/questions`);
        }
      };
      fetchQuestions();
    }

    let unsubscribeParticipants = () => {};

    const isAuthor = user && quiz?.authorId === user.uid;
    let unsubscribeQuiz = () => {};

    if (quiz?.id) {
      const quizRef = doc(db, 'quizzes', quiz.id);
      unsubscribeQuiz = onSnapshot(quizRef, (docSnap) => {
        if (docSnap.exists()) {
          const quizData = docSnap.data() as Quiz;
          // Only update if it's still active or if we're not the author (authors keep the object longer)
          setQuiz(prev => {
            if (!prev) return null;
            // If the quiz just became inactive and we are NOT the author, we handle it elsewhere
            // But if we ARE the author, we definitely want to stay informed
            return { ...prev, ...quizData };
          });
        }
      });
    }

    if (isAuthor && quiz?.id) {
      const participantsRef = collection(db, 'quizzes', quiz.id, 'responses');
      unsubscribeParticipants = onSnapshot(participantsRef, (snapshot) => {
        const fetchedParticipants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Participant[];
        setParticipants(fetchedParticipants);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `quizzes/${quiz.id}/responses`);
      });
    } else if (currentStudentRoll) {
      const docRef = doc(db, 'quizzes', quiz.id, 'responses', currentStudentRoll);
      unsubscribeParticipants = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const p = { id: docSnap.id, ...docSnap.data() } as Participant;
          setParticipants([p]);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `quizzes/${quiz.id}/responses/${currentStudentRoll}`);
      });
    }

    return () => {
      unsubscribeParticipants();
      unsubscribeQuiz();
    };
  }, [quiz?.id, user?.uid, currentStudentRoll]);

  const createQuiz = async (newQuiz: Quiz) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Check if there's already an active quiz
    const activeQuiz = quizzes.find(q => q.isActive);
    if (activeQuiz) {
      throw new Error("You already have an active quiz. Please end it before creating a new one.");
    }

    try {
      const quizzesRef = collection(db, 'quizzes');
      const quizData = {
        authorId: user.uid,
        title: newQuiz.title,
        totalQuestions: newQuiz.totalQuestions,
        drawCount: newQuiz.drawCount,
        roomCode: newQuiz.roomCode,
        isActive: true,
        allowedRollPatterns: newQuiz.allowedRollPatterns || [],
        createdAt: serverTimestamp(),
      };

      const quizDoc = await addDoc(quizzesRef, quizData);
      
      // Add questions as subcollection
      const questionsRef = collection(db, 'quizzes', quizDoc.id, 'questions');
      for (const question of newQuiz.questions) {
        await addDoc(questionsRef, {
          ...question,
          quizId: quizDoc.id
        });
      }

      const createdQuiz = {
        id: quizDoc.id,
        ...quizData,
        questions: newQuiz.questions
      };

      setQuiz(createdQuiz);
      localStorage.setItem('activeRoomCode', createdQuiz.roomCode);
      localStorage.removeItem('quizDraft');
      setDraftQuiz(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'quizzes');
    }
  };

  const saveDraft = (draft: Partial<Quiz>) => {
    setDraftQuiz(draft);
    localStorage.setItem('quizDraft', JSON.stringify(draft));
  };

  const resetQuiz = () => {
    setQuiz(null);
    setParticipants([]);
    setCurrentStudentRoll(null);
    localStorage.removeItem('activeRoomCode');
    localStorage.removeItem('currentStudentRoll');
  };

  const joinQuiz = async (p: Omit<Participant, 'id' | 'progress' | 'status' | 'answers' | 'questionOrder' | 'optionOrders'>, targetQuiz?: Quiz): Promise<boolean> => {
    const activeQuiz = targetQuiz || quiz;
    if (!activeQuiz?.id || !activeQuiz.isActive) return false;

    // Ensure the quiz state is set in the context
    if (!quiz || quiz.id !== activeQuiz.id) {
      setQuiz(activeQuiz);
    }

    try {
      const docRef = doc(db, 'quizzes', activeQuiz.id, 'responses', p.roll);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Resume existing session
        setCurrentStudentRoll(p.roll);
        localStorage.setItem('currentStudentRoll', p.roll);
        return true;
      }

      // Shuffle questions and options
      if (!activeQuiz.questions || activeQuiz.questions.length === 0) {
        // If questions are missing, we need to fetch them
        const questionsRef = collection(db, 'quizzes', activeQuiz.id, 'questions');
        const snapshot = await getDocs(questionsRef);
        activeQuiz.questions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Question[];
        setQuiz(activeQuiz);
      }

      const questions = activeQuiz.questions || [];
      let questionOrder = questions.map(q => q.id);
      questionOrder = shuffleArray(questionOrder);
      
      const drawCount = activeQuiz.drawCount || questions.length;
      
      // If drawCount is specified and less than total, take only that many
      if (drawCount > 0 && drawCount < questions.length) {
        questionOrder = questionOrder.slice(0, drawCount);
      }

      const optionOrders: Record<string, string[]> = {};
      questions.forEach(q => {
        optionOrders[q.id] = shuffleArray(['A', 'B', 'C', 'D']);
      });

      const newParticipant = {
        ...p,
        quizId: activeQuiz.id,
        studentId: user?.uid || null,
        progress: 0,
        status: 'Appearing' as const,
        answers: {},
        questionOrder,
        optionOrders,
        startTime: Date.now(),
        lastSeen: Date.now(),
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, newParticipant);
      setCurrentStudentRoll(p.roll);
      localStorage.setItem('currentStudentRoll', p.roll);
      
      // Save to history
      const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
      if (!history.find((h: any) => h.id === activeQuiz.id)) {
        history.push({
          id: activeQuiz.id,
          title: activeQuiz.title,
          roomCode: activeQuiz.roomCode,
          date: new Date().toISOString()
        });
        localStorage.setItem('quizHistory', JSON.stringify(history.slice(-10))); // Keep last 10
      }
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `quizzes/${activeQuiz.id}/responses/${p.roll}`);
      return false;
    }
  };

  const endQuiz = async (quizId: string) => {
    try {
      const quizRef = doc(db, 'quizzes', quizId);
      await updateDoc(quizRef, { isActive: false });
      
      // Clear local state immediately for better UX
      setQuiz(null);
      localStorage.removeItem('activeRoomCode');
      setQuizEnded(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quizzes/${quizId}`);
    }
  };

  const updateParticipant = async (roll: string, updates: Partial<Participant>) => {
    if (!quiz?.id) return;
    
    try {
      const docRef = doc(db, 'quizzes', quiz.id, 'responses', roll);
      await updateDoc(docRef, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quizzes/${quiz.id}/responses/${roll}`);
    }
  };

  const gradeParticipant = async (quizId: string, participantId: string, manualGrades: Record<string, number>) => {
    try {
      const docRef = doc(db, 'quizzes', quizId, 'responses', participantId);
      await updateDoc(docRef, { manualGrades });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quizzes/${quizId}/responses/${participantId}`);
    }
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      // 1. Delete responses subcollection
      const responsesRef = collection(db, 'quizzes', quizId, 'responses');
      const responsesSnapshot = await getDocs(responsesRef);
      for (const docSnap of responsesSnapshot.docs) {
        await deleteDoc(doc(db, 'quizzes', quizId, 'responses', docSnap.id));
      }

      // 2. Delete questions subcollection
      const questionsRef = collection(db, 'quizzes', quizId, 'questions');
      const questionsSnapshot = await getDocs(questionsRef);
      for (const docSnap of questionsSnapshot.docs) {
        await deleteDoc(doc(db, 'quizzes', quizId, 'questions', docSnap.id));
      }

      // 3. Delete the quiz document itself
      await deleteDoc(doc(db, 'quizzes', quizId));
      
      // Update local state
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
      if (quiz?.id === quizId) {
        setQuiz(null);
        localStorage.removeItem('activeRoomCode');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quizzes/${quizId}`);
    }
  };

  const isRollAllowed = (roll: string, patterns: string[]): boolean => {
    if (!patterns || patterns.length === 0) return true;

    // Normalize roll: remove spaces and dashes for comparison if needed, 
    // but user specified patterns like 2023-IMG-001-061
    const normalizedRoll = roll.trim().toUpperCase();

    return patterns.some(pattern => {
      // Pattern format: YEAR-CODE-START-END (e.g., 2023-IMG-001-061)
      const parts = pattern.split('-');
      if (parts.length !== 4) return false;

      const [year, code, startStr, endStr] = parts;
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      // Try to match the roll against the pattern
      // Roll format could be 2023IMG001 or 2023-IMG-001
      // Let's assume the roll is entered as 2023IMG001 or similar
      // We'll use a regex to extract parts from the roll
      const rollRegex = new RegExp(`^(${year})\\s*[-]?\\s*(${code})\\s*[-]?\\s*(\\d+)$`, 'i');
      const match = normalizedRoll.match(rollRegex);

      if (match) {
        const studentNum = parseInt(match[3], 10);
        return studentNum >= start && studentNum <= end;
      }

      return false;
    });
  };

  const calculateScore = (participant: Participant, quiz: Quiz, overrideQuestions?: Question[], excludeParagraphs: boolean = false): number => {
    let score = 0;
    let questions = overrideQuestions || quiz.questions || [];
    
    // If we have a specific question order for the participant, use only those questions
    if (!overrideQuestions && participant.questionOrder) {
      questions = questions.filter(q => participant.questionOrder!.includes(q.id));
    }

    const answers = participant.answers || {};

    const normalizeAttribute = (ans: any) => {
      if (ans === undefined || ans === null) return "";
      if (Array.isArray(ans)) return ans.slice().sort().join(",");
      return String(ans).trim().toUpperCase();
    };

    questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (studentAnswer === undefined || studentAnswer === null) return;

      if (q.type === 'Paragraph') {
        if (!excludeParagraphs && participant.manualGrades?.[q.id]) {
          score += participant.manualGrades[q.id];
        }
        return;
      }

      // Check possible correct answer fields: correctOption, correctAnswer, or correctOptions
      const correctAnswer = (q as any).correctAnswer || (q as any).correctOptions || q.correctOption;

      console.log({
        question: q.id,
        studentAnswer,
        correctAnswer
      });

      if (normalizeAttribute(studentAnswer) === normalizeAttribute(correctAnswer)) {
        score += 1;
      }
    });

    // Truncate to 2 decimal places
    return Math.floor(score * 100) / 100;
  };

  return (
    <QuizContext.Provider value={{ quiz, quizzes, participants, currentStudentRoll, draftQuiz, createQuiz, resetQuiz, saveDraft, joinQuiz, updateParticipant, endQuiz, findQuizByRoomCode, gradeParticipant, calculateScore, deleteQuiz, isRollAllowed, quizEnded, closeQuizEndedMessage, loading }}>
      {children}
    </QuizContext.Provider>
  );
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}
