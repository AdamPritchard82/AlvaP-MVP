import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, Candidate } from '../lib/api';

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

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSkillCounts();
        setCounts(res.counts || {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const skills = ['Public Affairs', 'Communications', 'Policy', 'Campaigns'];

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Library</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {skills.map((s) => (
          <Link key={s} to={`/library/${encodeURIComponent(s)}`}>
            <SkillTile name={s} count={counts[s] || 0} disabled={(counts[s] || 0) === 0} />
          </Link>
        ))}
      </div>
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
  const [rows, setRows] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const decodedSkill = decodeURIComponent(skill || '');
  const decodedBand = decodeURIComponent(band || '');

  useEffect(() => {
    (async () => {
      const res = await api.getCandidatesBySkillAndBand(decodedSkill, decodedBand, page, pageSize);
      setRows(res.candidates || []);
      setTotal(res.total || 0);
    })();
  }, [decodedSkill, decodedBand, page]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        <button className="underline" onClick={()=>navigate('/library')}>Library</button> →
        <button className="underline ml-1" onClick={()=>navigate(`/library/${encodeURIComponent(decodedSkill)}`)}>{decodedSkill}</button> → {decodedBand}
      </div>
      <h2 className="text-xl font-semibold">Candidates</h2>
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


