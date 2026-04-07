import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { subscribe } from '../api.js';
import toast from 'react-hot-toast';
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Bell,
  Mail,
  Loader2,
  User as UserIcon,
  X,
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!subEmail.trim()) return;
    setSubscribing(true);
    try {
      await subscribe(subEmail.trim());
      toast.success('Subscribed to notifications');
      setSubEmail('');
      setShowSubscribe(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-20">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-gray-900 leading-tight">StudyHub</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Collab Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Workspace</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </NavLink>

        {/* Subscribe accordion */}
        <div className="mt-6">
          <div className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Notifications</div>
          <button
            onClick={() => setShowSubscribe(!showSubscribe)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="flex-1 text-left">Email Updates</span>
            {showSubscribe && <X className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          {showSubscribe && (
            <form onSubmit={handleSubscribe} className="mt-2 px-3 space-y-2">
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-md text-xs placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <button
                type="submit"
                disabled={subscribing}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center justify-center gap-1"
              >
                {subscribing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Subscribe'}
              </button>
            </form>
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">{user?.username || 'User'}</div>
            <div className="text-[10px] text-gray-400 truncate">{user?.email || ''}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
