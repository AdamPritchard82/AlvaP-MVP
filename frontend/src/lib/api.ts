const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'consultant' | 'admin';
}

export interface Candidate {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  salary_min?: number;
  salary_max?: number;
  tags: string[];
  notes?: string;
  skills: {
    communications: boolean;
    campaigns: boolean;
    policy: boolean;
    publicAffairs: boolean;
  };
  email_ok: boolean;
  unsubscribe_token?: string;
  welcome_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  website?: string;
  careers_url?: string;
  tags: string[];
  contacts: Array<{
    name: string;
    email: string;
    role: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  client_id: string;
  title: string;
  salary_min?: number;
  salary_max?: number;
  tags: string[];
  status: 'sales_approaches' | 'new' | 'commissioned' | 'interview_stage_1' | 'interview_stage_2' | 'offered' | 'placed' | 'rejected';
  source?: string;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Match {
  id: string;
  job_id: string;
  candidate_id: string;
  score: number;
  stage: 'new' | 'reviewed' | 'contacted' | 'interviewed' | 'offered' | 'placed' | 'rejected';
  notes?: string;
  created_at: string;
  updated_at: string;
  job?: Job;
  candidate?: Candidate;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  border_color: string;
  position: number;
  is_default: boolean;
  is_first: boolean;
  created_at: string;
  updated_at: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string): Promise<{ token: string; user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Candidates
  async getCandidates(params?: { 
    q?: string; 
    tags?: string[]; 
    salaryMin?: number; 
    salaryMax?: number; 
    skills?: string[]; 
    mode?: 'AND' | 'OR'; 
    page?: number; 
    pageSize?: number 
  }): Promise<{ candidates: Candidate[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.tags && params.tags.length > 0) searchParams.set('tags', params.tags.join(','));
    if (params?.salaryMin) searchParams.set('salaryMin', params.salaryMin.toString());
    if (params?.salaryMax) searchParams.set('salaryMax', params.salaryMax.toString());
    if (params?.skills && params.skills.length > 0) searchParams.set('skills', params.skills.join(','));
    if (params?.mode) searchParams.set('mode', params.mode);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    
    const query = searchParams.toString();
    return this.request(`/candidates${query ? `?${query}` : ''}`);
  }

  async getCandidate(id: string): Promise<{ success: boolean; candidate: Candidate }> {
    return this.request(`/candidates/${id}`);
  }

  async createCandidate(candidate: Partial<Candidate>): Promise<{ success: boolean; id: string; message: string }> {
    return this.request('/candidates', {
      method: 'POST',
      body: JSON.stringify(candidate),
    });
  }

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<{ success: boolean; message: string }> {
    return this.request(`/candidates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCandidate(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/candidates/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadCV(id: string, file: File): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('cv', file);
    
    const response = await fetch(`${API_BASE}/candidates/${id}/cv`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async parseCV(file: File): Promise<{ success: boolean; data?: any; error?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/candidates/parse-cv`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Jobs
  async getJobs(params?: { search?: string; tags?: string[]; limit?: number; offset?: number }): Promise<{ jobs: Job[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tags && params.tags.length > 0) searchParams.set('tags', params.tags.join(','));
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const query = searchParams.toString();
    return this.request(`/jobs${query ? `?${query}` : ''}`);
  }

  async getJob(id: string): Promise<Job> {
    return this.request(`/jobs/${id}`);
  }

  async createJob(job: Partial<Job>): Promise<Job> {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    return this.request(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteJob(id: string): Promise<void> {
    return this.request(`/jobs/${id}`, {
      method: 'DELETE',
    });
  }

  // Clients
  async getClients(params?: { search?: string; tags?: string[]; limit?: number; offset?: number }): Promise<{ clients: Client[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tags && params.tags.length > 0) searchParams.set('tags', params.tags.join(','));
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const query = searchParams.toString();
    return this.request(`/clients${query ? `?${query}` : ''}`);
  }

  async getClient(id: string): Promise<Client> {
    return this.request(`/clients/${id}`);
  }

  async createClient(client: Partial<Client>): Promise<Client> {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClient(id: string): Promise<void> {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Matches
  async getMatches(params?: { job_id?: string; candidate_id?: string; stage?: string; page?: number; limit?: number }): Promise<{ matches: Match[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.job_id) searchParams.set('job_id', params.job_id);
    if (params?.candidate_id) searchParams.set('candidate_id', params.candidate_id);
    if (params?.stage) searchParams.set('stage', params.stage);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return this.request(`/matches${query ? `?${query}` : ''}`);
  }

  async createMatch(match: Partial<Match>): Promise<Match> {
    return this.request('/matches', {
      method: 'POST',
      body: JSON.stringify(match),
    });
  }

  async updateMatch(id: string, updates: Partial<Match>): Promise<Match> {
    return this.request(`/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteMatch(id: string): Promise<void> {
    return this.request(`/matches/${id}`, {
      method: 'DELETE',
    });
  }

  // Job-specific match operations
  async getJobMatches(jobId: string): Promise<{ matches: Match[] }> {
    return this.request(`/jobs/${jobId}/matches`);
  }

  async addJobMatch(jobId: string, candidateId: string, stage?: string): Promise<{ id: string }> {
    return this.request(`/jobs/${jobId}/matches`, {
      method: 'POST',
      body: JSON.stringify({ candidateId, stage }),
    });
  }

  async getJobRecommendations(jobId: string): Promise<Array<{ id: string; fullName: string; score: number }>> {
    return this.request(`/jobs/${jobId}/recommendations`);
  }

  // CSV Import
  async previewCSVImport(file: File): Promise<{
    success: boolean;
    preview: any[];
    totalRows: number;
    validRows: number;
    errorRows: number;
    errors: any[];
    fileId: string;
  }> {
    const formData = new FormData();
    formData.append('csv', file);
    
    const response = await fetch(`${API_BASE}/candidates/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async commitCSVImport(fileId: string, mapping: Record<string, string>): Promise<{
    success: boolean;
    imported: number;
    errors: number;
    candidates: any[];
    errorDetails: any[];
  }> {
    return this.request('/candidates/import/commit', {
      method: 'POST',
      body: JSON.stringify({ fileId, mapping }),
    });
  }

  // Emails
  async sendEmail(data: {
    to: string;
    subject: string;
    body: string;
    jobId?: string;
    candidateIds?: string[];
  }): Promise<{ success: boolean; id: string; message: string }> {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEmails(jobId?: string, limit?: number): Promise<{ success: boolean; emails: any[] }> {
    const searchParams = new URLSearchParams();
    if (jobId) searchParams.set('job_id', jobId);
    if (limit) searchParams.set('limit', limit.toString());
    
    const query = searchParams.toString();
    return this.request(`/emails${query ? `?${query}` : ''}`);
  }

  // Pipeline Stages
  async getPipelineStages(): Promise<PipelineStage[]> {
    return this.request('/pipeline-stages');
  }

  async createPipelineStage(stage: Partial<PipelineStage>): Promise<PipelineStage> {
    return this.request('/pipeline-stages', {
      method: 'POST',
      body: JSON.stringify(stage),
    });
  }

  async updatePipelineStage(id: string, updates: Partial<PipelineStage>): Promise<PipelineStage> {
    return this.request(`/pipeline-stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deletePipelineStage(id: string): Promise<void> {
    return this.request(`/pipeline-stages/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderPipelineStages(stages: { id: string; position: number }[]): Promise<void> {
    return this.request('/pipeline-stages/reorder', {
      method: 'POST',
      body: JSON.stringify({ stages }),
    });
  }

  // Licensing
  async getPlans(): Promise<any[]> {
    return this.request('/licensing/plans');
  }

  async getSubscription(): Promise<any> {
    return this.request('/licensing/subscription');
  }

  async createCheckoutSession(planId: string, billingCycle: 'monthly' | 'yearly'): Promise<{ url: string }> {
    return this.request('/licensing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, billingCycle }),
    });
  }

  async cancelSubscription() {
    return this.request('/licensing/cancel', {
      method: 'POST',
    });
  }

  // Events (replaces updates)
  async getEvents(params?: { 
    filter?: 'all' | 'new-roles'; 
    assignedTo?: 'me' | 'all';
    since?: string;
    limit?: number;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.assignedTo) searchParams.set('assignedTo', params.assignedTo);
    if (params?.since) searchParams.set('since', params.since);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.type) searchParams.set('type', params.type);
    
    const query = searchParams.toString();
    return this.request(`/events${query ? `?${query}` : ''}`);
  }

  async getUnreadCount(since?: string) {
    const searchParams = new URLSearchParams();
    if (since) searchParams.set('since', since);
    
    const query = searchParams.toString();
    return this.request(`/events/unread-count${query ? `?${query}` : ''}`);
  }

  // Open roles
  async getOpenRoles(params?: {
    assignedTo?: 'me' | 'all';
    since?: string;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.assignedTo) searchParams.set('assignedTo', params.assignedTo);
    if (params?.since) searchParams.set('since', params.since);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return this.request(`/jobs/open${query ? `?${query}` : ''}`);
  }

  // Job assignment
  async assignJob(jobId: string, assignedTo: string) {
    return this.request(`/jobs/${jobId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo })
    });
  }

  // Job ingest (internal)
  async ingestJob(jobData: {
    clientId: string;
    title: string;
    salaryMin?: number;
    salaryMax?: number;
    tags?: string[];
    source?: string;
    clientName?: string;
  }) {
    return this.request('/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
  }

  // Pipeline stages
  async getPipelineStages() {
    return this.request('/pipeline-stages');
  }

  // Update job
  async updateJob(jobId: string, updates: any) {
    return this.request(`/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  // Email preferences
  async updateCandidateEmailPreferences(candidateId: string, emailOk: boolean): Promise<Candidate> {
    return this.request(`/candidates/${candidateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ email_ok: emailOk }),
    });
  }

  async resendWelcomeEmail(candidateId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/candidates/${candidateId}/resend-welcome`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();

