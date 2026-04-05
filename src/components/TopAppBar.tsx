import { GraduationCap, User, LogOut, Zap, Timer, AlertCircle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useAuth } from "../context/AuthContext";

interface TopAppBarProps {
  variant?: "standard" | "quiz";
  progress?: number;
  currentTask?: string;
  timeLeft?: string;
  isLowTime?: boolean;
  onLogoClick?: () => void;
}

export default function TopAppBar({ variant = "standard", progress, currentTask, timeLeft, isLowTime, onLogoClick }: TopAppBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const LogoLink = () => {
    const content = (
      <div className="flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
          <Zap className="w-6 h-6" />
        </div>
        <span className="font-headline font-black text-2xl tracking-tighter text-on-surface uppercase">Kinetic Quiz</span>
      </div>
    );

    if (onLogoClick) {
      return (
        <button onClick={onLogoClick} className="flex items-center gap-3 group">
          {content}
        </button>
      );
    }

    return (
      <Link to="/" className="flex items-center gap-3 group">
        {content}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-md border-b border-surface-container">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3">
          <LogoLink />
        </div>

        {variant === "standard" && (
          <div className="flex items-center gap-6">
            {user && (
              <nav className="hidden md:flex gap-8">
                <Link
                  to="/dashboard"
                  className={cn(
                    "font-label font-medium transition-colors py-1",
                    location.pathname === "/dashboard" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"
                  )}
                >
                  {profile?.role === 'Student' ? 'Home' : 'Dashboard'}
                </Link>
                <Link
                  to="/join"
                  className={cn(
                    "font-label font-medium transition-colors py-1",
                    location.pathname === "/join" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"
                  )}
                >
                  Join
                </Link>
                {profile?.role !== 'Student' && (
                  <Link
                    to="/reports"
                    className={cn(
                      "font-label font-medium transition-colors py-1",
                      location.pathname === "/reports" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"
                    )}
                  >
                    Reports
                  </Link>
                )}
                <Link
                  to="/profile"
                  className={cn(
                    "font-label font-medium transition-colors py-1",
                    location.pathname === "/profile" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"
                  )}
                >
                  Profile
                </Link>
              </nav>
            )}
            
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-bold text-on-surface leading-none mb-1">{profile?.full_name || user.email}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">{profile?.role || 'Educator'}</p>
                </div>
                <Link to="/profile" className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container font-bold overflow-hidden shadow-sm border border-outline-variant/20">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </Link>
                <button 
                  onClick={handleSignOut}
                  className="p-2.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Sign In</Link>
                <Link to="/signup" className="px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Get Started</Link>
              </div>
            )}
          </div>
        )}

        {variant === "quiz" && (
          <div className="hidden md:flex items-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Progress</span>
              <span className="font-headline font-bold text-lg text-primary">{currentTask}</span>
            </div>
            
            <div className={cn(
              "relative flex items-center justify-center h-14 w-32 backdrop-blur-md rounded-xl px-4 overflow-hidden border-b-2 transition-colors duration-300",
              isLowTime ? "bg-error-container/50 border-error" : "bg-surface-container-highest/70 border-tertiary"
            )}>
              <div className="flex flex-col items-center z-10">
                <span className={cn(
                  "text-[10px] font-label font-bold uppercase tracking-tighter",
                  isLowTime ? "text-error" : "text-tertiary"
                )}>Time Left</span>
                <span className={cn(
                  "font-headline font-extrabold text-2xl",
                  isLowTime ? "text-error animate-pulse" : "text-on-surface"
                )}>{timeLeft}</span>
              </div>
              <div className={cn(
                "absolute inset-0 bg-gradient-to-t to-transparent",
                isLowTime ? "from-error-container/20" : "from-tertiary-container/20"
              )}></div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
