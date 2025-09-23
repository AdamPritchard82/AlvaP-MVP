import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface Contact {
  name: string;
  email: string;
  role: string;
}

export default function ClientNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/clients';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    careersUrl: '',
    tags: '',
    contacts: [] as Contact[]
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', email: '', role: '' }]
    }));
  };

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index)
    }));
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      const validContacts = formData.contacts.filter(contact => 
        contact.name && contact.email && contact.role
      );
      
      const clientData = {
        name: formData.name,
        website: formData.website || undefined,
        careersUrl: formData.careersUrl || undefined,
        tags,
        contacts: validContacts
      };

      const client = await api.createClient(clientData);
      toast.success('Client created successfully');
      
      // If we came from JobNew page, return there; otherwise go to client detail
      if (returnTo.includes('/jobs/new')) {
        navigate(returnTo);
      } else {
        navigate(`/clients/${client.id}`);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Failed to create client');
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
              onClick={() => navigate(returnTo)}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Add New Client
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Register a new client organization and their contact information.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Organization Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="Enter organization name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                className="input"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Careers Page URL
              </label>
              <input
                type="url"
                name="careersUrl"
                value={formData.careersUrl}
                onChange={handleInputChange}
                className="input"
                placeholder="https://example.com/careers"
              />
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
                placeholder="Enter tags separated by commas (e.g., tech, startup, nonprofit)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Tags help categorize and filter clients
              </p>
            </div>
          </div>

          {/* Contacts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Key Contacts</h3>
              <button
                type="button"
                onClick={addContact}
                className="btn btn-outline btn-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Contact
              </button>
            </div>

            {formData.contacts.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">No contacts added yet</p>
                <button
                  type="button"
                  onClick={addContact}
                  className="text-primary-600 hover:text-primary-500 text-sm font-medium"
                >
                  Add your first contact
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.contacts.map((contact, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">Contact {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-red-600 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <input
                        type="text"
                        placeholder="Full name"
                        value={contact.name}
                        onChange={(e) => updateContact(index, 'name', e.target.value)}
                        className="input"
                      />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={contact.email}
                        onChange={(e) => updateContact(index, 'email', e.target.value)}
                        className="input"
                      />
                      <input
                        type="text"
                        placeholder="Role/Title"
                        value={contact.role}
                        onChange={(e) => updateContact(index, 'role', e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="btn btn-outline btn-md"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-md"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Client
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


