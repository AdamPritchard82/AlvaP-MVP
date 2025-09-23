import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  MoreVertical,
  Building2,
  Globe,
  Users,
  ExternalLink
} from 'lucide-react';
import { api, Client } from '../lib/api';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, [searchTerm]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await api.getClients({
        search: searchTerm || undefined,
        limit: 50
      });
      setClients(response.clients || []);
    } catch (error) {
      toast.error('Failed to load clients');
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadClients();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Clients
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your client organizations and their contact information.
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <Link
            to="/clients/new"
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Clients
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="card p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search clients by name or website..."
                  className="input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-md"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No clients</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first client.
          </p>
          <div className="mt-6">
            <Link
              to="/clients/new"
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-12 w-12">
                    <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {client.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Added {formatDate(client.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/clients/${client.id}`}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/clients/${client.id}/edit`}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button className="text-gray-600 hover:text-gray-900">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {client.website && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600 flex items-center"
                    >
                      {client.website}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}

                {client.careers_url && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    <a
                      href={client.careers_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600 flex items-center"
                    >
                      Careers Page
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}

                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                  <span>{client.contacts.length} contact{client.contacts.length !== 1 ? 's' : ''}</span>
                </div>

                {client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {client.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                    {client.tags.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        +{client.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {client.contacts.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Key Contacts</h4>
                  <div className="space-y-1">
                    {client.contacts.slice(0, 2).map((contact, index) => (
                      <div key={index} className="text-sm text-gray-600">
                        <span className="font-medium">{contact.name}</span>
                        <span className="text-gray-400 mx-1">•</span>
                        <span>{contact.role}</span>
                      </div>
                    ))}
                    {client.contacts.length > 2 && (
                      <div className="text-sm text-gray-500">
                        +{client.contacts.length - 2} more contact{client.contacts.length - 2 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}







