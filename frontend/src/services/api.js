const API_URL = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('med_token');
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('med_token', token);
    else localStorage.removeItem('med_token');
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('med_token');
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    const url = `${API_URL}${endpoint}`;
    const config = {
      ...options,
      headers: { ...this.getHeaders(isFormData), ...options.headers },
    };
    if (options.body && !isFormData) {
      config.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, config);
    const payload = await res.json().catch(() => ({}));
    const message = payload?.msg || payload?.message;

    if (res.status === 401) {
      if (!endpoint.includes('/auth/')) {
        this.clearToken();
        window.location.href = '/login';
      }
      throw new Error(message || 'Сессия истекла');
    }

    if (res.status === 422) {
      if (message && /authorization|token|jwt|signature|expired/i.test(message)) {
        this.clearToken();
        window.location.href = '/login';
      }
      throw new Error(message || 'Ошибка 422');
    }

    if (!res.ok) {
      const err = new Error(message || `Ошибка ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  async login(email, password) {
    return this.request('/auth/login', { method: 'POST', body: { email, password } });
  }

  async verify2faLogin(tempToken, code) {
    const data = await this.request('/auth/2fa/verify-login', {
      method: 'POST',
      body: { temp_token: tempToken, code },
    });
    if (data.success && data.access_token) this.setToken(data.access_token);
    return data;
  }

  async register(userData) {
    return this.request('/auth/register', { method: 'POST', body: userData });
  }

  async verifyEmail(email, code) {
    const data = await this.request('/auth/verify-email', {
      method: 'POST',
      body: { email, code },
    });
    if (data.success && data.access_token) this.setToken(data.access_token);
    return data;
  }

  async resendVerification(email) {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: { email },
    });
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', { method: 'POST', body: { email } });
  }

  async resetPassword(email, code, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: { email, code, new_password: newPassword },
    });
  }

  // ─── Profile & 2FA ──────────────────────────────────────────────────────────

  async getProfile() {
    return this.request('/user/profile');
  }

  async setup2fa() {
    return this.request('/user/2fa/setup', { method: 'POST', body: {} });
  }

  async confirm2fa(code) {
    return this.request('/user/2fa/confirm', { method: 'POST', body: { code } });
  }

  async toggle2fa(enabled, password, code = '') {
    return this.request('/user/2fa', {
      method: 'PUT',
      body: { enabled, password, code },
    });
  }

  _qs(params) {
    const p = Object.entries(params).filter(([, v]) => v !== '' && v != null);
    return p.length ? `?${new URLSearchParams(p).toString()}` : '';
  }

  // ─── Doctors ────────────────────────────────────────────────────────────────

  async getDoctorsList() {
    return this.request('/doctors');
  }

  async createPersonalDoctor(data) {
    return this.request('/doctors', { method: 'POST', body: data });
  }

  // ─── Appointments ───────────────────────────────────────────────────────────

  async getAppointments(filters = {}) {
    return this.request(`/appointments${this._qs(filters)}`);
  }

  async getDoctors() {
    return this.getDoctorsList();
  }

  async createAppointment(appointment) {
    return this.request('/appointments', { method: 'POST', body: appointment });
  }

  async updateAppointment(id, updates) {
    return this.request(`/appointments/${id}`, { method: 'PUT', body: updates });
  }

  async deleteAppointment(id) {
    return this.request(`/appointments/${id}`, { method: 'DELETE' });
  }

  // ─── Analyses ───────────────────────────────────────────────────────────────

  async getAnalyses(filters = {}) {
    const params = typeof filters === 'string' ? { type: filters } : filters;
    return this.request(`/analyses${this._qs(params)}`);
  }

  async getAnalysisCatalog() {
    return this.request('/analysis-catalog');
  }

  async createAnalysisCatalogItem(data) {
    return this.request('/analysis-catalog', { method: 'POST', body: data });
  }

  async getAnalysisPanels() {
    return this.request('/analysis-panels');
  }

  async getAnalysisPanel(id) {
    return this.request(`/analysis-panels/${id}`);
  }

  async createAnalysisPanel(data) {
    return this.request('/analysis-panels', { method: 'POST', body: data });
  }

  async createAnalysesBatch(data) {
    return this.request('/analyses/batch', { method: 'POST', body: data });
  }

  async getAnalysisTypes() {
    return this.request('/analyses/types');
  }

  async createAnalysis(analysis) {
    return this.request('/analyses', { method: 'POST', body: analysis });
  }

  async updateAnalysis(id, updates) {
    return this.request(`/analyses/${id}`, { method: 'PUT', body: updates });
  }

  async deleteAnalysis(id) {
    return this.request(`/analyses/${id}`, { method: 'DELETE' });
  }

  // ─── Vaccines ───────────────────────────────────────────────────────────────

  async getVaccines(showAll = false) {
    const query = showAll ? '?all=true' : '';
    return this.request(`/vaccines${query}`);
  }

  async getUserVaccinations(filters = {}) {
    return this.request(`/user/vaccinations${this._qs(filters)}`);
  }

  async getVaccinationRecommendations() {
    return this.request('/user/vaccination-recommendations');
  }

  async getVaccineSchedules(vaccineId) {
    return this.request(`/vaccine-schedules${vaccineId ? `?vaccine_id=${vaccineId}` : ''}`);
  }

  async addUserVaccination(vaccinationData) {
    return this.request('/user/vaccinations', { method: 'POST', body: vaccinationData });
  }

  async updateUserVaccination(id, updates) {
    return this.request(`/user/vaccinations/${id}`, { method: 'PUT', body: updates });
  }

  async deleteUserVaccination(id) {
    return this.request(`/user/vaccinations/${id}`, { method: 'DELETE' });
  }

  // ─── Attachments ────────────────────────────────────────────────────────────

  async getAttachments(recordType, recordId) {
    return this.request(
      `/attachments?record_type=${recordType}&record_id=${recordId}`
    );
  }

  async uploadAttachment(recordType, recordId, file) {
    const form = new FormData();
    form.append('record_type', recordType);
    form.append('record_id', String(recordId));
    form.append('file', file);
    return this.request('/attachments', { method: 'POST', body: form });
  }

  getAttachmentDownloadUrl(attachmentId) {
    return `${API_URL}/attachments/${attachmentId}`;
  }

  async fetchAttachmentBlob(attachmentId) {
    const res = await fetch(this.getAttachmentDownloadUrl(attachmentId), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Не удалось загрузить файл');
    return res.blob();
  }

  async downloadAttachment(attachmentId, filename) {
    const blob = await this.fetchAttachmentBlob(attachmentId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'file';
    a.click();
    URL.revokeObjectURL(url);
  }

  async deleteAttachment(id) {
    return this.request(`/attachments/${id}`, { method: 'DELETE' });
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async adminCreateVaccine(data) {
    return this.request('/admin/vaccines', { method: 'POST', body: data });
  }

  async adminUpdateVaccine(id, data) {
    return this.request(`/admin/vaccines/${id}`, { method: 'PUT', body: data });
  }

  async adminDeleteVaccine(id) {
    return this.request(`/admin/vaccines/${id}`, { method: 'DELETE' });
  }

  async adminDeleteUser(id) {
    return this.request(`/admin/users/${id}`, { method: 'DELETE' });
  }

  async adminGetDoctors() {
    return this.request('/admin/doctors');
  }

  async adminCreateDoctor(data) {
    return this.request('/admin/doctors', { method: 'POST', body: data });
  }

  async adminDeleteDoctor(id) {
    return this.request(`/admin/doctors/${id}`, { method: 'DELETE' });
  }

  async adminCreateCatalogItem(data) {
    return this.request('/admin/analysis-catalog', { method: 'POST', body: data });
  }

  async adminDeleteCatalogItem(id) {
    return this.request(`/admin/analysis-catalog/${id}`, { method: 'DELETE' });
  }

  async adminCreatePanel(data) {
    return this.request('/admin/analysis-panels', { method: 'POST', body: data });
  }

  async adminUpdatePanel(id, data) {
    return this.request(`/admin/analysis-panels/${id}`, { method: 'PUT', body: data });
  }

  async adminDeletePanel(id) {
    return this.request(`/admin/analysis-panels/${id}`, { method: 'DELETE' });
  }

  async deleteAnalysesBatch(batchId) {
    return this.request(`/analyses/batch/${encodeURIComponent(batchId)}`, { method: 'DELETE' });
  }

  async adminCreateVaccineSchedule(data) {
    return this.request('/admin/vaccine-schedules', { method: 'POST', body: data });
  }

  async adminDeleteVaccineSchedule(id) {
    return this.request(`/admin/vaccine-schedules/${id}`, { method: 'DELETE' });
  }

  // ─── Calendar ───────────────────────────────────────────────────────────────

  async getCalendarEvents() {
    return this.request('/calendar/events');
  }

  async addCalendarEvent(eventData) {
    return this.request('/calendar/events', { method: 'POST', body: eventData });
  }

  async deleteCalendarEvent(table, recordId, extra = {}) {
    if (table === 'analysis_panel') {
      return this.deleteAnalysesBatch(extra.batchId);
    }
    if (table === 'appointments') return this.deleteAppointment(recordId);
    if (table === 'analyses') return this.deleteAnalysis(recordId);
    if (table === 'user_vaccinations') return this.deleteUserVaccination(recordId);
    throw new Error('Неизвестная таблица');
  }

  async updateCalendarEvent(table, recordId, updates) {
    if (table === 'appointments') return this.updateAppointment(recordId, updates);
    if (table === 'analyses') return this.updateAnalysis(recordId, updates);
    if (table === 'user_vaccinations') return this.updateUserVaccination(recordId, updates);
    throw new Error('Неизвестная таблица');
  }
}

export default new ApiService();
