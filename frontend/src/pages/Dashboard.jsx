import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { getProjects, createProject } from '../api.js';
import toast from 'react-hot-toast';
import {
  Plus,
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  Users,
  X,
  Loader2,
  CalendarDays,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          {loading ? (
            <div className="skeleton w-12 h-8 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-500" />
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const memberCount = project.members?.length || 0;
  const tasks = project.tasks || [];
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const createdDate = project.created_at
    ? new Date(project.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <Link
      to={`/projects/${project.project_id}`}
      className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 transition-colors"
    >
      <div className="mb-3">
        <h3 className="font-semibold text-gray-800 truncate">{project.name}</h3>
        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
          {project.description || 'No description'}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500">Task progress</span>
          <span className="text-gray-700 font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <ListTodo className="w-3.5 h-3.5" />
            {totalTasks} task{totalTasks !== 1 ? 's' : ''}
          </span>
        </div>
        {createdDate && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {createdDate}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      const list = res.data.projects || res.data || [];
      setProjects(list);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const totalTasks = projects.reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
  const completedTasks = projects.reduce(
    (sum, p) => sum + (p.tasks?.filter((t) => t.status === 'done').length || 0),
    0
  );
  const pendingDeadlines = projects.reduce(
    (sum, p) =>
      sum +
      (p.tasks?.filter((t) => {
        if (!t.deadline || t.status === 'done') return false;
        const dl = new Date(t.deadline);
        const now = new Date();
        const diff = (dl - now) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= 0;
      }).length || 0),
    0
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Project name is required');
      return;
    }
    setCreating(true);
    try {
      await createProject({ name: newName.trim(), description: newDesc.trim() });
      toast.success('Project created');
      setShowModal(false);
      setNewName('');
      setNewDesc('');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.username || 'there'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Here's what's happening across your projects.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FolderKanban} label="Total Projects" value={projects.length} loading={loading} />
        <StatCard icon={ListTodo} label="Total Tasks" value={totalTasks} loading={loading} />
        <StatCard icon={CheckCircle2} label="Completed" value={completedTasks} loading={loading} />
        <StatCard icon={Clock} label="Due This Week" value={pendingDeadlines} loading={loading} />
      </div>

      {/* Projects */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Your Projects</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="skeleton w-3/4 h-5 mb-2" />
              <div className="skeleton w-full h-4 mb-1" />
              <div className="skeleton w-2/3 h-4 mb-4" />
              <div className="skeleton w-full h-2 mb-4 rounded-full" />
              <div className="flex gap-4">
                <div className="skeleton w-20 h-3" />
                <div className="skeleton w-16 h-3" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-500 mb-5">
            Create your first project to get started!
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.project_id} project={project} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-white rounded-xl border border-gray-200 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Create New Project</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Project name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CS101 Group Assignment"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What's this project about?"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-colors"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
