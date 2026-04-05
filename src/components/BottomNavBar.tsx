import { LayoutDashboard, ClipboardList, BarChart3, User, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useAuth } from "../context/AuthContext";

export default function BottomNavBar() {
  const location = useLocation();
  const { profile } = useAuth();

  const isStudent = profile?.role === 'Student';

  const navItems = isStudent ? [
    { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
    { icon: Radio, label: "Join", path: "/join" },
    { icon: User, label: "Profile", path: "/profile" },
  ] : [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: ClipboardList, label: "Quizzes", path: "/quiz-editor" },
    { icon: Radio, label: "Join", path: "/join" },
    { icon: BarChart3, label: "Reports", path: "/reports" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-2 bg-white/80 backdrop-blur-xl shadow-[0_-10px_30px_rgba(42,43,81,0.04)] z-50 rounded-t-2xl md:hidden">
      {navItems.map((item) => (
        <Link
          key={item.label}
          to={item.path}
          className={cn(
            "flex flex-col items-center justify-center px-3 py-1 transition-all",
            location.pathname === item.path ? "bg-primary/10 text-primary rounded-xl scale-105" : "text-on-surface-variant hover:bg-slate-100"
          )}
        >
          <item.icon className={cn("w-6 h-6", location.pathname === item.path && "fill-current")} />
          <span className="font-label text-[10px] font-medium uppercase tracking-wider mt-1">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
