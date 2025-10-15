import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, Candidate, SavedFilter } from '../lib/api';
import { SavedFilters } from '../components/SavedFilters';

function SkillTile({ name, count, disabled }: { name: string; count: number; disabled?: boolean }) {
  return (
    <div className={`border rounded-lg p-6 shadow-sm ${disabled ? 'opacity-60 pointer-events-none' : 'hover:shadow'} bg-white`}> 
      <div className="text-xl font-semibold">{name}</div>
      <div className="mt-2 inline-flex items-center text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">{count} candidates</div>
    </div>
  );
}

export function LibrarySkills() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [taxonomyRoles, setTaxonomyRoles] = useState<Array<{ id: string; name: string; sortOrder: number }>>([]);
  const [hasActiveTaxonomy, setHasActiveTaxonomy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load taxonomy data
      const taxonomyResponse = await api.getActiveTaxonomy();
      if (taxonomyResponse.success) {
        setHasActiveTaxonomy(taxonomyResponse.hasActiveTaxonomy);
        setTaxonomyRoles(taxonomyResponse.roles || []);
      }
      
      // Load skill counts (fallback to legacy system if no taxonomy)
      const res = await api.getSkillCounts();
      setCounts(res.counts || {});
    } catch (error) {
      console.error('Error loading library data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  // If no active taxonomy, show legacy skills
  if (!hasActiveTaxonomy || taxonomyRoles.length === 0) {
    const legacySkills = ['Public Affairs', 'Communications', 'Policy', 'Campaigns'];
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {legacySkills.map((s) => (
            <Link key={s} to={`/library/${encodeURIComponent(s)}`}>
              <SkillTile name={s} count={counts[s] || 0} disabled={(counts[s] || 0) === 0} />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Show taxonomy-based roles
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Library</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {taxonomyRoles.map((role) => (
          <Link key={role.id} to={`/library/${encodeURIComponent(role.name)}`}>
            <SkillTile 
              name={role.name} 
              count={counts[role.name] || 0} 
              disabled={(counts[role.name] || 0) === 0} 
            />
          </Link>
        ))}
      </div>
      
      {/* Show message if more than 8 roles */}
      {taxonomyRoles.length > 8 && (
        <div className="text-center py-4">
          <p className="text-gray-600">
            Showing {taxonomyRoles.length} roles. Use the search and filters to find specific candidates.
          </p>
        </div>
      )}
    </div>
  );
}

export function LibraryBands() {
  const { skill } = useParams<{ skill: string }>();
  const navigate = useNavigate();
  const [bands, setBands] = useState<Array<{ band: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getBandsForSkill(decodeURIComponent(skill || ''));
        setBands(res.bands || []);
      } finally { setLoading(false); }
    })();
  }, [skill]);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600"><button className="underline" onClick={()=>navigate('/library')}>Library</button> → {decodeURIComponent(skill||'')}</div>
      <h2 className="text-xl font-semibold">Bands</h2>
      {bands.length === 0 ? (
        <div className="p-6 bg-white rounded border text-gray-700">No candidates yet in {decodeURIComponent(skill||'')}. <Link className="underline" to="/candidates/new">Add Candidate</Link></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {bands.map(b => (
            <Link key={b.band} to={`/library/${encodeURIComponent(skill||'')}/${encodeURIComponent(b.band)}`}>
              <div className="bg-white border rounded p-4 hover:shadow">
                <div className="font-medium">{b.band}</div>
                <div className="text-sm text-gray-600">{b.count} candidates</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryCandidates() {
  const { skill, band } = useParams<{ skill: string; band: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [columns, setColumns] = useState<any[]>([]);
  
  const decodedSkill = decodeURIComponent(skill || '');
  const decodedBand = decodeURIComponent(band || '');

  // Load URL parameters on mount
  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page') || '1');
    const urlPageSize = parseInt(searchParams.get('pageSize') || '20');
    const urlSearch = searchParams.get('search') || '';
    const urlSortBy = searchParams.get('sortBy') || 'created_at';
    const urlSortOrder = searchParams.get('sortOrder') || 'desc';
    const urlColumns = searchParams.get('columns')?.split(',') || [];

    setPage(urlPage);
    setPageSize(urlPageSize);
    setSearchKeyword(urlSearch);
    setSortBy(urlSortBy);
    setSortOrder(urlSortOrder);
    setColumns(urlColumns);
  }, [searchParams]);

  useEffect(() => {
    loadCandidates();
  }, [decodedSkill, decodedBand, page, pageSize, searchKeyword, sortBy, sortOrder]);

  const loadCandidates = async () => {
    try {
      const res = await api.getCandidatesBySkillAndBand(decodedSkill, decodedBand, page, pageSize);
      setRows(res.candidates || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    }
  };

  const updateUrl = (updates: Record<string, string | number>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value.toString());
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    if (filter.skill && filter.band) {
      navigate(`/library/${encodeURIComponent(filter.skill)}/${encodeURIComponent(filter.band)}`);
    }
    
    if (filter.searchKeyword) setSearchKeyword(filter.searchKeyword);
    if (filter.pageSize) setPageSize(filter.pageSize);
    if (filter.sortBy) setSortBy(filter.sortBy);
    if (filter.sortOrder) setSortOrder(filter.sortOrder);
    if (filter.columns) setColumns(filter.columns);
    
    // Update URL
    updateUrl({
      search: filter.searchKeyword || '',
      pageSize: filter.pageSize || 20,
      sortBy: filter.sortBy || 'created_at',
      sortOrder: filter.sortOrder || 'desc',
      columns: filter.columns?.map(c => c.key).join(',') || ''
    });
  };

  const currentFilter = {
    skill: decodedSkill,
    band: decodedBand,
    searchKeyword,
    columns,
    pageSize,
    sortBy,
    sortOrder,
    filters: {}
  };

  const handleExport = async () => {
    try {
      const exportData = {
        format: 'csv',
        filters: {
          skill: decodedSkill,
          band: decodedBand,
          search: searchKeyword,
          sortBy,
          sortOrder
        },
        columns: columns.length > 0 ? columns : ['full_name', 'email', 'phone', 'current_title', 'current_employer']
      };

      const response = await fetch(`${api['API_BASE'] || 'https://natural-kindness-production.up.railway.app/api'}/candidates/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `candidates-${decodedSkill}-${decodedBand}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export candidates');
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        <button className="underline" onClick={()=>navigate('/library')}>Library</button> →
        <button className="underline ml-1" onClick={()=>navigate(`/library/${encodeURIComponent(decodedSkill)}`)}>{decodedSkill}</button> → {decodedBand}
      </div>
      
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-semibold">Candidates</h2>
        <div className="flex items-center gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              updateUrl({ search: e.target.value });
            }}
            className="px-3 py-1 border rounded text-sm"
          />
          
          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => {
              const newPageSize = parseInt(e.target.value);
              setPageSize(newPageSize);
              updateUrl({ pageSize: newPageSize });
            }}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          
          {/* Export */}
          <button
            onClick={handleExport}
            className="btn btn-outline btn-sm"
          >
            📊 Export
          </button>
        </div>
      </div>

      {/* Saved Filters */}
      <SavedFilters
        currentFilter={currentFilter}
        onApplyFilter={handleApplyFilter}
        onSaveCurrentView={() => {}} // Will be handled by the component
      />
      {rows.length === 0 ? (
        <div className="p-6 bg-white rounded border text-gray-700">No candidates in this band yet.</div>
      ) : (
        <div className="bg-white border rounded">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">{c.full_name}</div>
                  </td>
                  <td className="px-6 py-4">{(c as any).current_title || '—'}</td>
                  <td className="px-6 py-4">{(c as any).current_employer || '—'}</td>
                  <td className="px-6 py-4">£{(c.salary_min||0).toLocaleString()} – £{(c.salary_max||0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right"><Link className="text-primary-600 underline" to={`/candidates/${c.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">Total: {total}</div>
            <div className="space-x-2">
              <button className="btn btn-outline btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</button>
              <button className="btn btn-outline btn-sm" disabled={(page*pageSize)>=total} onClick={()=>setPage(p=>p+1)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryEntry() {
  return <LibrarySkills />;
}




