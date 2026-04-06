import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import {
  getProject,
  updateProject,
  deleteProject,
  addMember,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getMessages,
  sendMessage,
  getFiles,
  uploadFile,
  deleteFile,
} from '../api.js';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ListTodo,
  MessageCircle,
  FolderOpen,
  Settings,
  Plus,
  X,
  Loader2,
  Send,
  Upload,
  Download,
  Trash2,
  UserPlus,
  Pencil,
  Calendar,
  Flag,
  ChevronDown,
  FileText,
  Image,
  FileArchive,
  File,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
} from 'lucide-react';

/* ============ Helpers ============ */

const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700' },
  done: { label: 'Done', color: 'bg-green-100 text-green-700' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-blue-600' },
  high: { label: 'High', color: 'text-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-600' },
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function fileIcon(type) {
  if (!type) return File;
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf')) return FileText;
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return FileArchive;
  return FileText;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ============ Main Component ============ */

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium', deadline: '', assignedTo: '',
  });
  const [taskSaving, setTaskSaving] = useState(false);

  // Chat
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [msgInput, setMsgInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef(null);
  const chatPollRef = useRef(null);

  // Files
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Settings
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Fetch project */
  const fetchProject = useCallback(async () => {
    try {
      const res = await getProject(id);
      const p = res.data.project || res.data;
      setProject(p);
      setSettingsForm({ name: p.name || '', description: p.description || '' });
    } catch {
      toast.error('Failed to load project');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  /* Fetch tasks */
  const fetchTasks = useCallback(async () => {
    try {
      const res = await getTasks(id);
      setTasks(res.data.tasks || res.data || []);
    } catch {
      // silent
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  /* Fetch messages */
  const fetchMessages = useCallback(async () => {
    try {
      const res = await getMessages(id);
      setMessages(res.data.messages || res.data || []);
    } catch {
      // silent
    } finally {
      setMessagesLoading(false);
    }
  }, [id]);

  /* Fetch files */
  const fetchFiles = useCallback(async () => {
    try {
      const res = await getFiles(id);
      setFiles(res.data.files || res.data || []);
    } catch {
      // silent
    } finally {
      setFilesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchMessages();
    fetchFiles();
  }, [fetchProject, fetchTasks, fetchMessages, fetchFiles]);

  /* Chat polling */
  useEffect(() => {
    if (activeTab === 'chat') {
      chatPollRef.current = setInterval(fetchMessages, 5000);
      return () => clearInterval(chatPollRef.current);
    }
  }, [activeTab, fetchMessages]);

  /* Auto-scroll chat */
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  /* ---- Task CRUD ---- */
  const openNewTask = () => {
    setEditingTask(null);
    setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '' });
    setShowTaskForm(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      assignedTo: task.assignedTo || '',
    });
    setShowTaskForm(true);
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    setTaskSaving(true);
    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        deadline: taskForm.deadline || undefined,
        assignedTo: taskForm.assignedTo || undefined,
      };
      if (editingTask) {
        await updateTask(editingTask.id, payload);
        toast.success('Task updated');
      } else {
        await createTask(id, payload);
        toast.success('Task created');
      }
      setShowTaskForm(false);
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await updateTask(task.id, { status: newStatus });
      fetchTasks();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
      fetchTasks();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  /* ---- Chat ---- */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    setSendingMsg(true);
    try {
      await sendMessage(id, msgInput.trim());
      setMsgInput('');
      fetchMessages();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  /* ---- Files ---- */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        await uploadFile(id, file.name, base64, file.type);
        toast.success('File uploaded');
        fetchFiles();
        setUploading(false);
      };
      reader.onerror = () => {
        toast.error('Failed to read file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Upload failed');
      setUploading(false);
    }
    e.target.value = '';
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deleteFile(id, fileId);
      toast.success('File deleted');
      fetchFiles();
    } catch {
      toast.error('Failed to delete file');
    }
  };

  /* ---- Settings ---- */
  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!settingsForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setSettingsSaving(true);
    try {
      await updateProject(id, {
        name: settingsForm.name.trim(),
        description: settingsForm.description.trim(),
      });
      toast.success('Project updated');
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setAddingMember(true);
    try {
      await addMember(id, memberEmail.trim());
      toast.success('Member added');
      setMemberEmail('');
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      await deleteProject(id);
      toast.success('Project deleted');
      navigate('/');
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="skeleton w-40 h-5 mb-4" />
        <div className="skeleton w-80 h-8 mb-2" />
        <div className="skeleton w-96 h-4 mb-8" />
        <div className="skeleton w-full h-12 mb-6 rounded-lg" />
        <div className="skeleton w-full h-64 rounded-lg" />
      </div>
    );
  }

  if (!project) return null;

  const members = project.members || [];
  const tabs = [
    { key: 'tasks', label: 'Tasks', icon: ListTodo, count: tasks.length },
    { key: 'chat', label: 'Chat', icon: MessageCircle, count: messages.length },
    { key: 'files', label: 'Files', icon: FolderOpen, count: files.length },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-800 truncate">{project.name}</h1>
          <p className="text-gray-500 mt-1 text-sm">{project.description || 'No description'}</p>
          {members.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {members.map((m, i) => (
                <span key={m.user_id || i} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {m.username || m.email}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => { setActiveTab('settings'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 rounded-lg text-sm font-medium text-gray-600 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add Member
        </button>
      </div>

      {/* Tabs - underline style */}
      <div className="flex gap-6 border-b border-gray-200 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {/* ==== TASKS TAB ==== */}
        {activeTab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Tasks</h2>
              <button
                onClick={openNewTask}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>

            {tasksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="skeleton w-3/4 h-5 mb-2" />
                    <div className="flex gap-3">
                      <div className="skeleton w-16 h-5 rounded-full" />
                      <div className="skeleton w-20 h-5 rounded-full" />
                      <div className="skeleton w-24 h-5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <ListTodo className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No tasks yet</p>
                <p className="text-sm text-gray-400 mt-1">Create a task to get your team started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
                  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-800 truncate">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-gray-500 mb-2 line-clamp-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {/* Status Badge */}
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                            {/* Priority */}
                            <span className={`text-xs font-medium ${priority.color}`}>
                              {priority.label}
                            </span>
                            {/* Deadline */}
                            {task.deadline && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {/* Assigned */}
                            {task.assignedTo && (
                              <span className="text-xs text-gray-400">
                                {task.assignedTo}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {/* Status dropdown */}
                          <div className="relative">
                            <select
                              value={task.status || 'todo'}
                              onChange={(e) => handleStatusChange(task, e.target.value)}
                              className="appearance-none bg-gray-50 border border-gray-200 rounded-md text-xs px-2 py-1 pr-6 text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Review</option>
                              <option value="done">Done</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                          <button
                            onClick={() => openEditTask(task)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Task Form Modal */}
            {showTaskForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg mx-4">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">
                      {editingTask ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button onClick={() => setShowTaskForm(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleTaskSubmit} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                      <input
                        type="text"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        placeholder="Task title"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                      <textarea
                        value={taskForm.description}
                        onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                        placeholder="Task details..."
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                        <div className="relative">
                          <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={taskForm.priority}
                            onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
                        <input
                          type="date"
                          value={taskForm.deadline}
                          onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
                      <div className="relative">
                        <select
                          value={taskForm.assignedTo}
                          onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.user_id || m.email} value={m.username || m.email}>
                              {m.username || m.email}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setShowTaskForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={taskSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-colors">
                        {taskSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingTask ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {editingTask ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==== CHAT TAB ==== */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 320px)' }}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="skeleton w-8 h-8 rounded-full shrink-0" />
                      <div className="flex-1">
                        <div className="skeleton w-24 h-3 mb-1" />
                        <div className="skeleton w-48 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageCircle className="w-10 h-10 mb-2" />
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation with your team.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isOwn = msg.user_id === user?.user_id || msg.username === user?.username;
                  return (
                    <div key={msg.message_id || i} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {getInitials(msg.username || 'U')}
                      </div>
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <span className="text-xs font-medium text-gray-700">{msg.username || 'User'}</span>
                          <span className="text-xs text-gray-400">{formatTime(msg.created_at || msg.timestamp)}</span>
                        </div>
                        <div className={`px-3.5 py-2 rounded-xl text-sm ${
                          isOwn
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-3 flex gap-2">
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgInput.trim()}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}

        {/* ==== FILES TAB ==== */}
        {activeTab === 'files' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Files</h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-colors"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload File
              </button>
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            </div>

            {filesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
                    <div className="skeleton w-10 h-10 rounded-lg" />
                    <div className="flex-1">
                      <div className="skeleton w-48 h-4 mb-1" />
                      <div className="skeleton w-24 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No files uploaded</p>
                <p className="text-sm text-gray-400 mt-1">Upload documents, images, or other files to share with your team.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => {
                  const FileIcon = fileIcon(f.file_type);
                  return (
                    <div
                      key={f.file_id || i}
                      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <FileIcon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                        <p className="text-xs text-gray-400">
                          {f.uploaded_by && `${f.uploaded_by} · `}
                          {f.created_at ? formatTime(f.created_at) : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {(f.file_url || f.url) && (
                          <a
                            href={f.file_url || f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteFile(f.file_id || f.id)}
                          className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==== SETTINGS TAB ==== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Edit Project */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Project Settings</h2>
              <form onSubmit={handleUpdateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name</label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-colors"
                >
                  {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Changes
                </button>
              </form>
            </div>

            {/* Members */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Members</h2>
              <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Enter email to invite"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={addingMember}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-colors"
                >
                  {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add
                </button>
              </form>
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={m.user_id || i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                      {getInitials(m.username || m.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.username || 'User'}</p>
                      <p className="text-xs text-gray-500 truncate">{m.email || ''}</p>
                    </div>
                    {m.role === 'owner' && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Owner</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg border border-red-200 p-6">
              <h2 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-500 mb-4">
                Permanently delete this project and all its data. This action cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 font-medium text-sm rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Project
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700 flex-1">Are you sure? This will permanently delete the project.</p>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium text-sm rounded-md transition-colors"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
