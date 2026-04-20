import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithEmailAndPassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isDemoMode } from '../firebase';

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  department: string;
  role: string;
  updated_at: any;
}

interface AuthContextType {
  user: User | any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, username: string, role: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | any | null>(() => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_user');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_profile');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Subscribe to profile changes
        const profileRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as Profile);
          } else {
            // Create initial profile if it doesn't exist
            const initialProfile: Profile = {
              id: user.uid,
              full_name: user.displayName || '',
              username: user.email?.split('@')[0] || '',
              avatar_url: user.photoURL || '',
              bio: '',
              department: '',
              role: 'teacher',
              updated_at: serverTimestamp(),
            };
            setDoc(profileRef, initialProfile);
            setProfile(initialProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error fetching profile:', error);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    if (isDemoMode) {
      setUser(null);
      setProfile(null);
      localStorage.removeItem('demo_user');
      localStorage.removeItem('demo_profile');
      return;
    }
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    if (isDemoMode) {
      const mockUser = { uid: 'demo-teacher', displayName: 'Demo Teacher', email: 'demo@kinetic.edu' };
      const mockProfile: Profile = {
        id: 'demo-teacher',
        full_name: 'Demo Teacher',
        username: 'demoteacher',
        avatar_url: 'https://picsum.photos/seed/teacher/100/100',
        bio: 'Default demo account.',
        department: 'Science',
        role: 'teacher',
        updated_at: new Date().toISOString()
      };
      setUser(mockUser);
      setProfile(mockProfile);
      localStorage.setItem('demo_user', JSON.stringify(mockUser));
      localStorage.setItem('demo_profile', JSON.stringify(mockProfile));
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      const mockUser = { uid: 'demo-teacher', displayName: 'Demo Teacher', email };
      const mockProfile: Profile = {
        id: 'demo-teacher',
        full_name: 'Demo Teacher',
        username: 'demoteacher',
        avatar_url: 'https://picsum.photos/seed/teacher/100/100',
        bio: 'Default demo account.',
        department: 'Science',
        role: 'teacher',
        updated_at: new Date().toISOString()
      };
      setUser(mockUser);
      setProfile(mockProfile);
      localStorage.setItem('demo_user', JSON.stringify(mockUser));
      localStorage.setItem('demo_profile', JSON.stringify(mockProfile));
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string, username: string, role: string) => {
    if (isDemoMode) {
      const mockUser = { uid: 'demo-' + Date.now(), displayName: name, email };
      const mockProfile: Profile = {
        id: mockUser.uid,
        full_name: name,
        username,
        avatar_url: '',
        bio: '',
        department: '',
        role,
        updated_at: new Date().toISOString()
      };
      setUser(mockUser);
      setProfile(mockProfile);
      localStorage.setItem('demo_user', JSON.stringify(mockUser));
      localStorage.setItem('demo_profile', JSON.stringify(mockProfile));
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update auth profile
      await updateProfile(user, { displayName: name });

      // Create firestore profile
      const profileRef = doc(db, 'users', user.uid);
      const initialProfile: Profile = {
        id: user.uid,
        full_name: name,
        username: username,
        avatar_url: '',
        bio: '',
        department: '',
        role: role,
        updated_at: serverTimestamp(),
      };
      await setDoc(profileRef, initialProfile);
    } catch (error) {
      console.error('Error signing up with email:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) throw new Error("No user logged in");
    
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await firebaseUpdatePassword(user, newPassword);
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    // Profile is handled by onSnapshot, so this is mostly for compatibility
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle, signInWithEmail, signUpWithEmail, changePassword, sendPasswordReset, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
