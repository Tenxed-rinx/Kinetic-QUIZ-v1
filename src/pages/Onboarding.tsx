import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { User, BookOpen, Globe, Info, ArrowRight, Loader2, Camera, GraduationCap, Briefcase } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export default function Onboarding() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'Teacher' | 'Student'>('Teacher');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    } else if (!authLoading && profile) {
      navigate('/dashboard');
    }
  }, [user, profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        fullName,
        bio,
        department,
        role,
        avatarUrl: `https://picsum.photos/seed/${user.uid}/200/200`,
        email: user.email,
        createdAt: new Date().toISOString()
      });
      await refreshProfile();
      navigate('/dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      setError("Failed to save profile. Please try again.");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-primary-container/10 blur-[100px] -z-10"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[35rem] h-[35rem] rounded-full bg-secondary-container/10 blur-[80px] -z-10"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-surface-container-lowest p-10 md:p-16 rounded-3xl border border-outline-variant/15 shadow-2xl relative z-10"
      >
        <div className="text-center mb-12">
          <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-4">Complete Your Profile</h1>
          <p className="text-on-surface-variant font-body text-lg">Tell us a bit about yourself to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Role Selection */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-label ml-1">I am a...</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('Teacher')}
                className={cn(
                  "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
                  role === 'Teacher' 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-outline-variant/30 text-on-surface-variant hover:border-primary/50"
                )}
              >
                <Briefcase className="w-8 h-8" />
                <span className="font-headline font-bold">Teacher</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('Student')}
                className={cn(
                  "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
                  role === 'Student' 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-outline-variant/30 text-on-surface-variant hover:border-primary/50"
                )}
              >
                <GraduationCap className="w-8 h-8" />
                <span className="font-headline font-bold">Student</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-10">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-32 h-32 rounded-full bg-surface-container-low border-4 border-surface-container shadow-inner flex items-center justify-center overflow-hidden">
                <User className="w-16 h-16 text-outline-variant" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Profile Photo</span>
            </div>

            <div className="flex-grow space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-label ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-label ml-1">Department / Class</label>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body"
                    placeholder={role === 'Teacher' ? "Computer Science" : "Grade 10-A"}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-label ml-1">
              {role === 'Teacher' ? 'Professional Bio' : 'About Me'}
            </label>
            <div className="relative group">
              <Info className="absolute left-4 top-6 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
              <textarea 
                required
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body resize-none"
                placeholder={role === 'Teacher' ? "Share your passion for education..." : "Tell us about your interests..."}
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-sm font-medium"
            >
              {error}
            </motion.div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-primary text-on-primary font-headline font-bold text-lg rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Start Your Journey</span>}
            {!loading && <ArrowRight className="w-6 h-6" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
