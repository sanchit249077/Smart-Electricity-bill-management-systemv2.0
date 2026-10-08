const API_BASE = '/api';

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = payload?.message || payload?.error || (typeof payload === 'string' ? payload : 'Request failed');
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const encode = (value) => encodeURIComponent(JSON.stringify(value ?? {}));

const makeEntity = (name) => ({
  list: (sort, limit) => request(`/entities/${name}?sort=${encodeURIComponent(sort || '')}&limit=${limit || 100}`),
  filter: (filters, sort, limit) => request(`/entities/${name}?filters=${encode(filters)}&sort=${encodeURIComponent(sort || '')}&limit=${limit || 100}`),
  create: (data) => request(`/entities/${name}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => request(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  bulkUpdate: (items) => request(`/entities/${name}/bulk`, { method: 'PATCH', body: JSON.stringify({ items }) }),
  subscribe: (callback) => {
    const timer = window.setInterval(() => callback?.(), 5000);
    return () => window.clearInterval(timer);
  },
});

export const api = {
  auth: {
    me: () => request('/auth/me'),
    loginViaEmailPassword: async (email, password) => {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      return result;
    },
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    updateMe: (data) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
    resetPasswordRequest: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: ({ resetToken, newPassword }) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ resetToken, newPassword }) }),
    setToken: () => {},
    logout: async () => { await request('/auth/logout', { method: 'POST' }).catch(() => {}); },
    loginWithProvider: async () => { throw new Error('Google sign-in is not configured in this standalone version. Use email and password.'); },
    redirectToLogin: (returnTo = '/') => { window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`; },
  },
  app: {
    getPublicSettings: async () => ({ id: 'smartpower-local', public_settings: { name: 'SmartPower' } }),
  },
  entities: Object.fromEntries([
    'Bill','Payment','Complaint','TheftAlert','User','ConsumptionData','Appliance','SolarData','Notification','Outage','Tariff'
  ].map((name) => [name, makeEntity(name)])),
  functions: {
    invoke: (name, payload) => request(`/functions/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(payload || {}) }),
  },
};


