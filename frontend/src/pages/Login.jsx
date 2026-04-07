import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { login as apiLogin } from '../api.js';
import toast from 'react-hot-toast';
import {
  GraduationCap,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  Users,
  BookOpen,
  MessageSquare,
  Zap,
} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (type) => {
    if (type === 'admin') {
      setEmail('admin@anji.com');
      setPassword('admin123');
    } else {
      setEmail('user@anji.com');
      setPassword('user123');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT: brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white p-12 flex-col justify-between overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-white/5 rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold">StudyHub</div>
              <div className="text-xs text-white/70 uppercase tracking-wider">Collaboration Platform</div>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Learn together.<br />
            Build faster.
          </h2>
          <p className="text-white/80 text-base max-w-md">
            Organise study projects, share resources, and track progress with your classmates in one place.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          <Feature icon={Users} text="Team up on shared projects" />
          <Feature icon={BookOpen} text="Track tasks and resources" />
          <Feature icon={MessageSquare} text="Email notifications for updates" />
          <Feature icon={Zap} text="Deployed on AWS serverless" />
        </div>

        <div className="relative z-10 text-xs text-white/50">
          National College of Ireland · Cloud Platform Programming
        </div>
      </div>

      {/* RIGHT: form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand header */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-3">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">StudyHub</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to continue to StudyHub</p>

          {/* Demo credentials callout at top (distinct from Goutham's bottom card and Rakshan's pill) */}
          <div className="mb-6 border border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Quick demo access</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="flex flex-col items-start gap-0.5 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors text-left"
              >
                <span className="text-[10px] font-semibold text-blue-600 uppercase">Admin</span>
                <span className="text-[11px] text-gray-600 truncate w-full">admin@anji.com</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('user')}
                className="flex flex-col items-start gap-0.5 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors text-left"
              >
                <span className="text-[10px] font-semibold text-blue-600 uppercase">User</span>
                <span className="text-[11px] text-gray-600 truncate w-full">user@anji.com</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-all shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            New here?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Create a free account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm text-white/90">{text}</span>
    </div>
  );
}
