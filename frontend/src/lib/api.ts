// Hardcode API base to the backend service (stable, known-working)
const API_BASE = 'https://natural-kindness-production.up.railway.app/api';

// Runtime visibility to confirm the API base in production bundles
try { 
  console.log('APP_API_BASE', API_BASE);
  console.log('APP_BOOT', { 
    timestamp: new Date().toISOString(),
    env: import.meta.env.MODE,
    prod: import.meta.env.PROD,
    runtimeConfig: (window as any).__APP_CONFIG__
  });
} catch {}

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

export interface SavedFilter {
  id: string;
  name: string;
  skill?: string;
  band?: string;
  searchKeyword?: string;
  columns?: any[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
  filters?: any;
  createdAt: string;
  lastUsed?: string;
  lastUpdated?: string;
}

// Portal interfaces
export interface PortalProfile {
  id: string;
  firstName: string;
  lastName: string;
  currentTitle: string;
  currentEmployer: string;
  email: string;
  phone: string;
  skills: {
    communications?: number;
    campaigns?: number;
    policy?: number;
    publicAffairs?: number;
  };
  salaryMin?: number;
  salaryMax?: number;
  lastUpdated: string;
}

export interface PortalApplication {
  id: string;
  jobTitle: string;
  client: string;
  stage: string;
  lastMovementDate: string;
  status: 'active' | 'closed' | 'placed';
}

// Job Board interfaces
export interface PublicJob {
  id: string;
  title: string;
  publicSummary: string;
  clientPublicName: string;
  location: string;
  employmentType: string;
  salaryMin: number;
  salaryMax: number;
  requiredSkills: {
    communications?: boolean;
    campaigns?: boolean;
    policy?: boolean;
    publicAffairs?: boolean;
  };
  publicSlug: string;
  createdAt: string;
}

export interface JobPublishResponse {
  success: boolean;
  data: {
    id: string;
    isPublic: boolean;
    publicSlug: string;
    publicUrl: string | null;
  };
  message: string;
}

export interface JobInterestData {
  name: string;
  email: string;
  message?: string;
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
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string, role: 'consultant' | 'admin' = 'consultant'): Promise<{ token: string; user: User; message: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request('/auth/me');
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

  async parseCV(file: File): Promise<{ success: boolean; data?: any; error?: string; parserUsed?: string }> {
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

  // Library - skills and bands
  async getSkillCounts(): Promise<{ success: boolean; counts: Record<string, number> }> {
    return this.request('/skills/counts');
  }

  async getBandsForSkill(skill: string): Promise<{ success: boolean; bands: Array<{ band: string; count: number }> }> {
    const encoded = encodeURIComponent(skill);
    return this.request(`/skills/${encoded}/bands`);
  }

  async getCandidatesBySkillAndBand(skill: string, band: string, page = 1, pageSize = 20): Promise<{ success: boolean; candidates: Candidate[]; total: number; page: number; pageSize: number }> {
    const s = encodeURIComponent(skill);
    const b = encodeURIComponent(band);
    return this.request(`/skills/${s}/bands/${b}/candidates?page=${page}&pageSize=${pageSize}`);
  }

  // Saved Filters
  async getSavedFilters(): Promise<{ success: boolean; filters: SavedFilter[] }> {
    return this.request('/user/saved-filters');
  }

  async saveFilter(filterData: {
    name: string;
    skill?: string;
    band?: string;
    searchKeyword?: string;
    columns?: any[];
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
    filters?: any;
  }): Promise<{ success: boolean; filter: SavedFilter; message: string }> {
    return this.request('/user/saved-filters', {
      method: 'POST',
      body: JSON.stringify(filterData),
    });
  }

  async updateSavedFilter(filterId: string, updates: Partial<SavedFilter>): Promise<{ success: boolean; preferences: any; message: string }> {
    return this.request(`/user/saved-filters/${filterId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSavedFilter(filterId: string): Promise<{ success: boolean; preferences: any; message: string }> {
    return this.request(`/user/saved-filters/${filterId}`, {
      method: 'DELETE',
    });
  }

  async applySavedFilter(filterId: string): Promise<{ success: boolean; preferences: any; message: string }> {
    return this.request(`/user/saved-filters/${filterId}/apply`, {
      method: 'POST',
    });
  }

  // Analytics
  async getSkillsBandsAnalytics(): Promise<{ success: boolean; skillCounts: any; bandsData: any; generatedAt: string }> {
    return this.request('/analytics/skills-bands');
  }

  async getPipelineAnalytics(): Promise<{ success: boolean; pipeline: any; generatedAt: string }> {
    return this.request('/analytics/pipeline');
  }

  async getEmailOutcomesAnalytics(): Promise<{ success: boolean; emailOutcomes: any; generatedAt: string }> {
    return this.request('/analytics/email-outcomes');
  }

  async getRecentActivityAnalytics(limit = 10): Promise<{ success: boolean; activities: any[]; total: number; generatedAt: string }> {
    return this.request(`/analytics/recent-activity?limit=${limit}`);
  }

  // Matching Engine
  async getJobMatches(jobId: string, limit = 10, offset = 0): Promise<{ 
    success: boolean; 
    total: number; 
    items: any[]; 
    limit: number; 
    offset: number; 
    job_id: number; 
    job_title: string; 
    search_time_ms: number 
  }> {
    return this.request(`/jobs/${jobId}/matches?limit=${limit}&offset=${offset}`);
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

  // Portal methods
  async generatePortalLink(candidateId: string): Promise<{ success: boolean; portalUrl: string; expiresIn: string; message: string }> {
    return this.request(`/candidates/${candidateId}/portal-link`, {
      method: 'POST'
    });
  }

  async getPortalProfile(token: string): Promise<{ success: boolean; profile: PortalProfile }> {
    return this.request('/portal/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  async getPortalApplications(token: string): Promise<{ success: boolean; applications: PortalApplication[]; message: string }> {
    return this.request('/portal/me/applications', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  // Job Board methods
  async publishJob(jobId: string): Promise<JobPublishResponse> {
    return this.request(`/jobs/${jobId}/publish`, {
      method: 'POST'
    });
  }

  async updateJobPublicFields(jobId: string, fields: {
    publicSummary?: string;
    clientPublicName?: string;
    location?: string;
    employmentType?: string;
  }): Promise<{ success: boolean; data: any; message: string }> {
    return this.request(`/jobs/${jobId}/public-fields`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
  }

  async getPublicJobs(params?: {
    page?: number;
    pageSize?: number;
    skill?: string;
    band?: string;
    location?: string;
    employmentType?: string;
    search?: string;
  }): Promise<{ success: boolean; data: PublicJob[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/public/jobs${query ? `?${query}` : ''}`);
  }

  async getPublicJob(slug: string): Promise<{ success: boolean; data: PublicJob }> {
    return this.request(`/public/jobs/${slug}`);
  }

  async submitJobInterest(slug: string, data: JobInterestData): Promise<{ success: boolean; message: string; data: any }> {
    return this.request(`/public/jobs/${slug}/interest`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Jobs Pipeline API
  async updateJobStatus(jobId: string, status: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async getJobPipelineMatches(jobId: string): Promise<{ success: boolean; data: { candidates: any[] } }> {
    return this.request(`/jobs/${jobId}/matches`);
  }

  async addJobPipelineMatch(jobId: string, candidateId: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/jobs/${jobId}/matches`, {
      method: 'POST',
      body: JSON.stringify({ candidateId, stage: 'New' })
    });
  }

  async updateMatchStage(matchId: string, stage: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/matches/${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage })
    });
  }

  async searchCandidates(query: string): Promise<{ success: boolean; data: { candidates: any[] } }> {
    return this.request(`/candidates/search?q=${encodeURIComponent(query)}`);
  }

  // Taxonomy methods
  async getActiveTaxonomy(): Promise<{ 
    success: boolean; 
    roles: Array<{ id: string; name: string; sortOrder: number }>; 
    skillsByRole: Record<string, Array<{ name: string; weight: number; scale_max: number }>>;
    hasActiveTaxonomy: boolean;
    taxonomy?: { id: string; name: string; createdAt: string; updatedAt: string };
  }> {
    return this.request('/taxonomy/active');
  }

  async getTaxonomyPresets(): Promise<{ 
    success: boolean; 
    presets: Array<{ 
      name: string; 
      roles: string[]; 
      skillsByRole: Record<string, Array<{ name: string; weight: number }>> 
    }> 
  }> {
    return this.request('/taxonomy/presets');
  }

  async createTaxonomy(data: {
    name: string;
    industries: string[];
    roles: string[];
    skillsByRole: Record<string, Array<{ name: string; weight?: number; scale_max?: number }>>;
  }): Promise<{ success: boolean; message: string; taxonomyId: string }> {
    return this.request('/admin/taxonomy', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async checkTaxonomyUsage(roleIds?: string[], skillIds?: string[]): Promise<{
    success: boolean;
    usage: {
      roles: Record<string, { inUse: boolean; candidateCount: number; message: string }>;
      skills: Record<string, { inUse: boolean; candidateCount: number; message: string }>;
    };
  }> {
    const params = new URLSearchParams();
    if (roleIds && roleIds.length > 0) params.set('roleIds', roleIds.join(','));
    if (skillIds && skillIds.length > 0) params.set('skillIds', skillIds.join(','));
    
    const query = params.toString();
    return this.request(`/admin/taxonomy/usage${query ? `?${query}` : ''}`);
  }

  async deleteTaxonomyRole(roleId: string, force = false): Promise<{ success: boolean; message: string }> {
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    
    const query = params.toString();
    return this.request(`/admin/taxonomy/roles/${roleId}${query ? `?${query}` : ''}`, {
      method: 'DELETE'
    });
  }

  async deleteTaxonomySkill(skillId: string, force = false): Promise<{ success: boolean; message: string }> {
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    
    const query = params.toString();
    return this.request(`/admin/taxonomy/skills/${skillId}${query ? `?${query}` : ''}`, {
      method: 'DELETE'
    });
  }

  // Billing API methods
  async getBillingSummary() {
    return this.get('/billing/summary');
  }

  async getBillingPlans() {
    return this.get('/billing/plans');
  }

  async getPromoCodes() {
    return this.get('/billing/promo-codes');
  }

  async applyPromoCode(code: string) {
    return this.post('/billing/promo/apply', { code });
  }

  async switchPlan(planCode: string) {
    return this.post('/billing/plan/switch', { planCode });
  }

  async beginTrial() {
    return this.post('/billing/trial/begin');
  }

  async getTrialStatus() {
    return this.get('/billing/trial/status');
  }

  async getBillingProviderStatus() {
    return this.get('/billing/provider/status');
  }

  async getSessionStats() {
    return this.get('/billing/sessions/stats');
  }
}

export const api = new ApiClient();

