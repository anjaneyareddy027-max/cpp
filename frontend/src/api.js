import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('studyhub_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('studyhub_token');
      localStorage.removeItem('studyhub_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = (username, email, password) =>
  api.post('/auth/register', { username, email, password });

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

// Projects
export const getProjects = () => api.get('/projects');

export const createProject = (data) => api.post('/projects', data);

export const getProject = (id) => api.get(`/projects/${id}`);

export const updateProject = (id, data) => api.put(`/projects/${id}`, data);

export const deleteProject = (id) => api.delete(`/projects/${id}`);

export const addMember = (projectId, email) =>
  api.post(`/projects/${projectId}/members`, { email });

// Tasks
export const getTasks = (projectId) => api.get(`/projects/${projectId}/tasks`);

export const createTask = (projectId, data) =>
  api.post(`/projects/${projectId}/tasks`, data);

export const updateTask = (taskId, data) => api.put(`/tasks/${taskId}`, data);

export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}`);

// Messages
export const getMessages = (projectId) =>
  api.get(`/projects/${projectId}/messages`);

export const sendMessage = (projectId, content) =>
  api.post(`/projects/${projectId}/messages`, { content });

// Files
export const uploadFile = (projectId, fileName, fileContent, fileType) =>
  api.post(`/projects/${projectId}/files`, {
    file_name: fileName,
    file_content: fileContent,
    file_type: fileType,
  });

export const getFiles = (projectId) =>
  api.get(`/projects/${projectId}/files`);

export const deleteFile = (projectId, fileId) =>
  api.delete(`/projects/${projectId}/files/${fileId}`);

// Subscriptions
export const subscribe = (email) => api.post('/subscribe', { email });

export const getSubscriberCount = () => api.get('/subscribe/count');

export default api;
