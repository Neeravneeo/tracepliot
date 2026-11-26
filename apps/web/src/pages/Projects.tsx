import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import { useAppContext } from '../context/AppContext';

export const Projects = () => {
  const { currentProjectId, setCurrentProjectId } = useAppContext();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const res = await fetchApi('/projects');
      setProjects(res.data || []);
      if (res.data && res.data.length > 0 && !currentProjectId) {
        setCurrentProjectId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;
    setCreating(true);
    try {
      const res = await fetchApi('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProjectName })
      });
      setNewApiKey(res.initialApiKey);
      setNewProjectName('');
      await loadProjects();
      setCurrentProjectId(res.project.id);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#fff' }}>Loading projects...</div>;
  }

  return (
    <div style={{ padding: '40px 24px', maxWidth: 'var(--page-max-width)', margin: '0 auto', width: '100%' }}>
      <div className="text-heading" style={{ marginBottom: 40 }}>Projects</div>

      {newApiKey && (
        <div style={{ padding: 16, background: '#10B98120', border: '1px solid #10B981', borderRadius: 8, marginBottom: 24, color: '#fff' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#10B981' }}>Project Created Successfully!</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 14 }}>Please copy your new SDK key. It will not be shown again.</p>
          <code style={{ background: '#000', padding: 12, borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
            {newApiKey}
          </code>
          <button onClick={() => setNewApiKey(null)} style={{ marginTop: 12, background: 'none', border: '1px solid #10B981', color: '#10B981', padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-white)', margin: 0 }}>Your Projects</h3>
          </div>
          <div className="card-body">
            {projects.length === 0 ? (
              <div style={{ color: 'var(--color-warm-granite)', fontSize: 14 }}>No projects found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projects.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 8, background: currentProjectId === p.id ? 'var(--color-surface-hover)' : 'transparent' }}>
                    <div>
                      <div style={{ color: 'var(--color-white)', fontWeight: 500, marginBottom: 4 }}>{p.name}</div>
                      <div style={{ color: 'var(--color-warm-granite)', fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}>{p.id}</div>
                    </div>
                    {currentProjectId !== p.id && (
                      <button onClick={() => setCurrentProjectId(p.id)} style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        Switch
                      </button>
                    )}
                    {currentProjectId === p.id && (
                      <span style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 500 }}>Active</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-white)', margin: 0 }}>Create New Project</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12 }}>
              <input 
                type="text" 
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="Project Name" 
                required
                style={{ flex: 1, background: 'var(--color-background)', border: '1px solid var(--color-border)', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
              />
              <button disabled={creating} type="submit" style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Projects;
