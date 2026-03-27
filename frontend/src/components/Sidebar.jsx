import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';

export default function Navbar() {
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
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-3 z-10">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-800">StudyHub</span>
        </NavLink>

        {/* Center: Nav links */}
        <div className="flex items-center gap-6">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
        </div>

        {/* Right: Subscribe, User, Logout */}
        <div className="flex items-center gap-4">
          {/* Subscribe toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSubscribe(!showSubscribe)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Subscribe to notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            {showSubscribe && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg p-3 z-20">
                <p className="text-xs font-medium text-gray-500 mb-2">Get email notifications</p>
                <form onSubmit={handleSubscribe} className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="email"
                      value={subEmail}
                      onChange={(e) => setSubEmail(e.target.value)}
                      placeholder="Email for updates"
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs font-medium text-white transition-colors"
                  >
                    {subscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Go'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <span className="text-sm text-gray-600">
            {user?.username || 'User'}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
