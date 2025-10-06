import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Plus, Search, X } from 'lucide-react';
import { api, Client } from '../lib/api';
import toast from 'react-hot-toast';

export default function JobNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    title: '',
    salaryMin: '',
    salaryMax: '',
    tags: '',
    status: 'discovered', // Default to first stage in our funnel
    source: ''
  });

  useEffect(() => {
    loadClients();
    loadPipelineStages();
  }, []);

  // Reload clients when returning from client creation
  useEffect(() => {
    const handleFocus = () => {
      loadClients();
    };
    
    // Also reload when the page becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadClients();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.getClients({ limit: 100 });
      setClients(response.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      // Don't show error toast for clients - just continue with empty list
      console.log('Continuing without clients - user can still create job');
    } finally {
      setLoadingClients(false);
    }
  };

  const loadPipelineStages = async () => {
    try {
      setLoadingStages(true);
      const stages = await api.getPipelineStages();
      setPipelineStages(stages || []);
      
      // Set default status to first stage if available
      if (stages && stages.length > 0 && !formData.status) {
        setFormData(prev => ({ ...prev, status: stages[0].id }));
      }
    } catch (error) {
      console.error('Error loading pipeline stages:', error);
      // Fallback to hardcoded stages if API fails
      const fallbackStages = [
        { id: 'discovered', name: 'Discovered' },
        { id: 'researching', name: 'Researching' },
        { id: 'approaching', name: 'Approaching' },
        { id: 'in_discussion', name: 'In Discussion' },
        { id: 'commissioned', name: 'Commissioned' },
        { id: 'interview_stage_1', name: 'Interview 1' },
        { id: 'interview_stage_2', name: 'Interview 2' },
        { id: 'offered', name: 'Offered' },
        { id: 'placed', name: 'Placed' },
        { id: 'rejected', name: 'Rejected' }
      ];
      setPipelineStages(fallbackStages);
    } finally {
      setLoadingStages(false);
    }
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientSearchTerm(client.name);
    setFormData(prev => ({ ...prev, clientId: client.id }));
    setIsNewClient(false);
    setShowClientDropdown(false);
  };

  const handleNewClientClick = () => {
    setIsNewClient(true);
    setSelectedClient(null);
    setClientSearchTerm('');
    setFormData(prev => ({ ...prev, clientId: '' }));
    setShowClientDropdown(false);
  };

  const handleClientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setClientSearchTerm(value);
    setShowClientDropdown(true);
    setIsNewClient(false);
    setSelectedClient(null);
    setFormData(prev => ({ ...prev, clientId: value }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Handle "New Client" selection
    if (name === 'clientId' && value === '__new_client__') {
      navigate('/clients/new?returnTo=/jobs/new');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      // Handle client - either existing or new
      let clientId = formData.clientId;
      if (isNewClient || !selectedClient) {
        // Create a new client
        const clientData = {
          name: formData.clientId,
          website: '',
          tags: []
        };
        const newClient = await api.createClient(clientData);
        clientId = newClient.id;
      } else {
        // Use existing client
        clientId = selectedClient.id;
      }
      
      const jobData = {
        clientId: clientId,
        title: formData.title,
        salaryMin: formData.salaryMin ? parseInt(formData.salaryMin) : undefined,
        salaryMax: formData.salaryMax ? parseInt(formData.salaryMax) : undefined,
        tags,
        status: formData.status,
        source: formData.source || undefined
      };

      const job = await api.createJob(jobData);
      toast.success('Job created successfully');
      navigate('/jobs');
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/jobs')}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Create New Job
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Add a new job posting for a client.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Job Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client *
              </label>
              {loadingClients ? (
                <div className="input flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                  Loading clients...
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      ref={clientInputRef}
                      type="text"
                      value={clientSearchTerm}
                      onChange={handleClientSearchChange}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                      required
                      className="input pl-10 pr-10"
                      placeholder={isNewClient ? "Enter new client name" : "Search existing clients or type new name"}
                    />
                    {clientSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setClientSearchTerm('');
                          setSelectedClient(null);
                          setIsNewClient(false);
                          setFormData(prev => ({ ...prev, clientId: '' }));
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredClients.length > 0 && (
                        <div className="p-2">
                          <div className="text-xs font-medium text-gray-500 mb-1">Existing Clients</div>
                          {filteredClients.map(client => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => handleClientSelect(client)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                            >
                              {client.name}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="border-t border-gray-200">
                        <button
                          type="button"
                          onClick={handleNewClientClick}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-600 font-medium text-sm flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {clientSearchTerm ? `Create "${clientSearchTerm}"` : "Create New Client"}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {isNewClient && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center">
                      <Plus className="h-3 w-3 mr-1" />
                      Will create a new client
                    </p>
                  )}
                  
                  {selectedClient && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <Building2 className="h-3 w-3 mr-1" />
                      Selected: {selectedClient.name}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="Enter job title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="input"
              >
                {pipelineStages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleInputChange}
                className="input"
                placeholder="e.g., LinkedIn, Indeed, Direct"
              />
            </div>
          </div>

          {/* Salary Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Salary Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Salary
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">£</span>
                  </div>
                  <input
                    type="number"
                    name="salaryMin"
                    value={formData.salaryMin}
                    onChange={handleInputChange}
                    min="10000"
                    max="200000"
                    step="10000"
                    className="input pl-8"
                    placeholder="10000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Salary
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">£</span>
                  </div>
                  <input
                    type="number"
                    name="salaryMax"
                    value={formData.salaryMax}
                    onChange={handleInputChange}
                    min="10000"
                    max="200000"
                    step="10000"
                    className="input pl-8"
                    placeholder="200000"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                className="input"
                placeholder="Enter tags separated by commas (e.g., marketing, digital, campaigns)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Tags help match candidates to this job
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="btn btn-outline btn-md"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-md"
            disabled={loading || loadingClients}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Job
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

