import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { subscribe } from '../api.js';
import toast from 'react-hot-toast';
import {
  GraduationCap,
  LayoutDashboard,
  FolderKanban,
  Bell,
  LogOut,
  ChevronRight,
  Mail,
  Loader2,
} from 'lucide-react';

export default function Sidebar({ projectCount = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!subEmail.trim()) return;
    setSubscribing(true);
    try {
      await subscribe(subEmail.trim());
      toast.success('Subscribed to notifications');
      setSubEmail('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  const navItems = [
    {
      to: '/',
      icon: LayoutDashboard,
      label: 'Dashboard',
      exact: true,
    },
    {
      to: '/',
      icon: FolderKanban,
      label: 'My Projects',
      badge: projectCount,
      exact: true,
    },
  ];

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">StudyHub</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Collaboration Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Menu
        </p>

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
              isActive
                ? 'bg-indigo-600/20 text-indigo-300'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <LayoutDashboard className={`w-[18px] h-[18px] ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
              <span>Dashboard</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-indigo-400" />
              )}
            </>
          )}
        </NavLink>

        <NavLink
          to="/"
          className={() => {
            const isProject = location.pathname.startsWith('/projects');
            return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
              isProject
                ? 'bg-indigo-600/20 text-indigo-300'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`;
          }}
        >
          <FolderKanban className="w-[18px] h-[18px] text-slate-400 group-hover:text-slate-300" />
          <span>My Projects</span>
          {projectCount > 0 && (
            <span className="ml-auto bg-slate-700 text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full">
              {projectCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* Subscribe Section */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-3.5 h-3.5 text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Notifications
          </p>
        </div>
        <form onSubmit={handleSubscribe} className="flex gap-1.5">
          <div className="relative flex-1">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="email"
              value={subEmail}
              onChange={(e) => setSubEmail(e.target.value)}
              placeholder="Email for updates"
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={subscribing}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md text-xs font-medium transition-colors flex items-center"
          >
            {subscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Go'
            )}
          </button>
        </form>
      </div>

      {/* User Info */}
      <div className="px-4 py-3 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.username || 'User'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
