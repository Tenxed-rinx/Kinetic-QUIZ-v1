import TopAppBar from "@/src/components/TopAppBar";
import BottomNavBar from "@/src/components/BottomNavBar";
import { User, Mail, Shield, Settings, LogOut, Edit2, Calendar, Award, BookOpen, Globe, ChevronRight, Radio, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useAuth } from "../context/AuthContext";
import { useQuiz, Participant, Quiz, Question } from "../context/QuizContext";
import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

export default function Profile() {
  const { user, profile, signOut, refreshProfile, changePassword } = useAuth();
  const { quizzes } = useQuiz();
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!user || quizzes.length === 0) return;
      try {
        const participantsList: Participant[] = [];
        for (const quiz of quizzes) {
          if (quiz.id) {
            // Fetch questions if missing
            if (!quiz.questions || quiz.questions.length === 0) {
              const questionsRef = collection(db, 'quizzes', quiz.id, 'questions');
              const questionsSnapshot = await getDocs(questionsRef);
              quiz.questions = questionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Question[];
            }

            const responsesRef = collection(db, 'quizzes', quiz.id, 'responses');
            const snapshot = await getDocs(responsesRef);
            snapshot.docs.forEach(doc => {
              participantsList.push({ id: doc.id, ...doc.data() } as Participant);
            });
          }
        }
        setAllParticipants(participantsList);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'responses');
      }
    };
    fetchParticipants();
  }, [user, quizzes]);

  const calculateScore = (participant: Participant, quiz: Quiz) => {
    if (!quiz.questions || !participant.answers) return 0;
    let correct = 0;
    quiz.questions.forEach(q => {
      const participantAnswer = participant.answers[q.id];
      if (participantAnswer === q.correctOption) {
        correct++;
      }
    });
    return Math.round((correct / quiz.totalQuestions) * 100);
  };

  const stats = useMemo(() => {
    const totalStudents = allParticipants.length;
    let totalScore = 0;
    let scoredCount = 0;

    allParticipants.forEach(p => {
      const quiz = quizzes.find(q => q.id === p.quizId);
      if (quiz && p.status === 'Submitted') {
        totalScore += calculateScore(p, quiz);
        scoredCount++;
      }
    });

    const avgAccuracy = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;
    const rating = 5.0; 

    return {
      totalStudents,
      avgAccuracy,
      rating
    };
  }, [quizzes, allParticipants]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    fullName: profile?.fullName || '',
    bio: profile?.bio || '',
    department: profile?.department || '',
    role: profile?.role || 'Educator'
  });

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, editedProfile);
      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setPasswordError(null);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setPasswordSuccess(false);
        setIsChangingPassword(false);
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) return null;

  const teacherInfo = {
    name: profile.fullName,
    email: user.email,
    role: profile.role || "Educator",
    department: profile.department,
    joinedDate: user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A',
    quizzesCreated: quizzes.length,
    studentsTaught: stats.totalStudents,
    rating: stats.rating,
    bio: profile.bio,
    avatar: profile.avatarUrl || `https://picsum.photos/seed/${user.uid}/200/200`
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="bg-surface min-h-screen pb-24 flex flex-col">
      <TopAppBar />
      
      <main className="flex-grow p-6 md:p-12 max-w-5xl mx-auto w-full">
        {isEditing ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest p-8 md:p-12 rounded-[3rem] border border-outline-variant/10 shadow-xl max-w-2xl mx-auto"
          >
            <h2 className="font-headline text-3xl font-bold mb-8 text-center">Edit Profile</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={editedProfile.fullName}
                  onChange={(e) => setEditedProfile({...editedProfile, fullName: e.target.value})}
                  className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Role</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setEditedProfile({...editedProfile, role: 'Educator'})}
                    className={cn(
                      "py-4 rounded-2xl border-2 font-bold transition-all",
                      editedProfile.role === 'Educator' ? "border-primary bg-primary/5 text-primary" : "border-outline-variant/30 text-on-surface-variant"
                    )}
                  >
                    Educator
                  </button>
                  <button
                    onClick={() => setEditedProfile({...editedProfile, role: 'Student'})}
                    className={cn(
                      "py-4 rounded-2xl border-2 font-bold transition-all",
                      editedProfile.role === 'Student' ? "border-primary bg-primary/5 text-primary" : "border-outline-variant/30 text-on-surface-variant"
                    )}
                  >
                    Student
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Department / Class</label>
                <input 
                  type="text" 
                  value={editedProfile.department}
                  onChange={(e) => setEditedProfile({...editedProfile, department: e.target.value})}
                  className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Bio</label>
                <textarea 
                  value={editedProfile.bio}
                  onChange={(e) => setEditedProfile({...editedProfile, bio: e.target.value})}
                  rows={4}
                  className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 border border-outline-variant/30 text-on-surface font-bold rounded-2xl hover:bg-surface-container-low transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="flex-1 py-4 bg-primary text-on-primary font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <header className="mb-12 flex flex-col md:flex-row items-center gap-10">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-br from-primary to-secondary rounded-full blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-surface-container shadow-xl">
                  <img 
                    src={teacherInfo.avatar} 
                    alt={teacherInfo.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="absolute bottom-2 right-2 p-2.5 bg-primary text-on-primary rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </motion.div>

              <div className="flex-grow text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">{teacherInfo.name}</h1>
                  <span className="px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 self-center md:self-auto">
                    <Shield className="w-3 h-3" />
                    {teacherInfo.role}
                  </span>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-6 mb-6">
                  <div className="flex items-center gap-2 text-on-surface-variant font-body">
                    <Mail className="w-4 h-4 text-primary" />
                    {teacherInfo.email}
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant font-body">
                    <Globe className="w-4 h-4 text-primary" />
                    {teacherInfo.department}
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant font-body">
                    <Calendar className="w-4 h-4 text-primary" />
                    Joined {teacherInfo.joinedDate}
                  </div>
                </div>

                <p className="text-on-surface-variant font-body leading-relaxed max-w-2xl mx-auto md:mx-0">
                  {teacherInfo.bio}
                </p>
              </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[
                { label: "Quizzes Created", value: teacherInfo.quizzesCreated, icon: BookOpen, color: "text-blue-500", hide: teacherInfo.role === 'Student' },
                { label: "Students Taught", value: teacherInfo.studentsTaught, icon: User, color: "text-purple-500", hide: teacherInfo.role === 'Student' },
                { label: "Quizzes Joined", value: teacherInfo.studentsTaught, icon: Radio, color: "text-blue-500", hide: teacherInfo.role !== 'Student' },
                { label: "Avg. Accuracy", value: `${stats.avgAccuracy}%`, icon: Award, color: "text-amber-500" },
              ].filter(s => !s.hide).map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm text-center"
                >
                  <stat.icon className={cn("w-8 h-8 mx-auto mb-4", stat.color)} />
                  <p className="text-3xl font-headline font-black text-on-surface mb-1">{stat.value}</p>
                  <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Settings and Actions */}
            <div className="space-y-4">
              <h2 className="font-headline font-bold text-xl text-on-surface mb-6 px-2">Account Settings</h2>
              
              {[
                { label: "Personal Information", icon: User, description: "Update your name, bio, and profile picture.", onClick: () => setIsEditing(true) },
                { label: "Security & Password", icon: Shield, description: "Manage your account security and password.", onClick: () => setIsChangingPassword(true) },
                { label: "Notification Preferences", icon: Settings, description: "Choose how and when you want to be notified." },
                { label: "Log Out", icon: LogOut, description: "Sign out of your account on this device.", danger: true, onClick: handleSignOut },
              ].map((item, i) => (
                <button 
                  key={item.label}
                  onClick={item.onClick}
                  className={cn(
                    "w-full p-6 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:shadow-md transition-all",
                    item.danger ? "bg-error/5 hover:bg-error/10 border-error/10" : "bg-surface-container-lowest hover:bg-surface-container-low"
                  )}
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      item.danger ? "bg-error/10 text-error" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary"
                    )}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className={cn("font-headline font-bold text-lg", item.danger ? "text-error" : "text-on-surface")}>{item.label}</p>
                      <p className="text-sm text-on-surface-variant font-body">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-5 h-5", item.danger ? "text-error" : "text-outline")} />
                </button>
              ))}
            </div>

            {/* Change Password Modal */}
            <AnimatePresence>
              {isChangingPassword && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-surface-container-lowest p-8 rounded-[2.5rem] shadow-2xl border border-outline-variant/10 max-w-md w-full"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-headline text-2xl font-extrabold text-on-surface">Security</h3>
                        <p className="text-sm text-on-surface-variant">Update your account password</p>
                      </div>
                    </div>

                    {passwordSuccess ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-12 text-center"
                      >
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                        <h4 className="font-headline text-xl font-bold text-on-surface mb-2">Password Updated!</h4>
                        <p className="text-on-surface-variant">Your security settings have been updated successfully.</p>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleChangePassword} className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Current Password</label>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
                            <input 
                              type={showPasswords.current ? "text" : "password"} 
                              required
                              value={passwordForm.currentPassword}
                              onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                              className="w-full pl-12 pr-12 py-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                              placeholder="••••••••"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                            >
                              {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">New Password</label>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
                            <input 
                              type={showPasswords.new ? "text" : "password"} 
                              required
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                              className="w-full pl-12 pr-12 py-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                              placeholder="••••••••"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                            >
                              {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Confirm New Password</label>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
                            <input 
                              type={showPasswords.confirm ? "text" : "password"} 
                              required
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                              className="w-full pl-12 pr-12 py-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                              placeholder="••••••••"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                            >
                              {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {passwordError && (
                          <p className="text-error text-sm font-medium px-1">{passwordError}</p>
                        )}

                        <div className="flex gap-4 pt-4">
                          <button 
                            type="button"
                            onClick={() => setIsChangingPassword(false)}
                            className="flex-1 py-4 bg-surface-container-low text-on-surface font-bold rounded-xl hover:bg-surface-container transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update"}
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      <BottomNavBar />
    </div>
  );
}
