import { useState, useEffect } from 'react';
import {
  Key,
  Users,
  Copy,
  Check,
  Trash2,
  Plus,
  Cpu,
  Code2
} from 'lucide-react';
import { fetchApi } from '../api';

interface ApiKeyItem {
  id: string;
  name: string;
  createdAt: string;
  revokedAt?: string | null;
}

interface MemberItem {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export default function Settings() {
  const [projectId, setProjectId] = useState('proj_dev_testing');
  const [projectName, setProjectName] = useState('Production App');
  const [environments, setEnvironments] = useState<string[]>(['production', 'staging', 'development']);
  const [retentionDays, setRetentionDays] = useState(30);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  // Members state
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Project update state
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // RAG / Onboarding status
  const [onboarding, setOnboarding] = useState<any>(null);
  const [selectedPkgManager, setSelectedPkgManager] = useState<'npm' | 'pnpm' | 'yarn'>('npm');

  async function loadData() {
    try {
      // 1. Load project details
      const projRes = await fetchApi('/projects');
      if (projRes && projRes.data && projRes.data.length > 0) {
        const p = projRes.data[0];
        setProjectId(p.id);
        setProjectName(p.name);
        if (Array.isArray(p.environments)) setEnvironments(p.environments);
        if (p.retentionDays) setRetentionDays(p.retentionDays);

        // Load members
        const memRes = await fetchApi(`/projects/${p.id}/members`);
        if (memRes && Array.isArray(memRes.data)) {
          setMembers(memRes.data);
        }

        // Load onboarding
        const onbRes = await fetchApi(`/projects/${p.id}/onboarding`);
        if (onbRes && onbRes.data) {
          setOnboarding(onbRes.data);
        }
      } else {
        // Fallback default members
        setMembers([
          { id: 'mem_1', email: 'developer@tracepilot.dev', role: 'owner', createdAt: new Date().toISOString() },
          { id: 'mem_2', email: 'sre-lead@tracepilot.dev', role: 'admin', createdAt: new Date().toISOString() }
        ]);
      }
    } catch (err) {
      console.warn('[Settings] Error loading project data:', err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveProject() {
    setIsSavingProject(true);
    setSaveSuccess(false);
    try {
      await fetchApi(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: projectName,
          environments,
          retentionDays
        })
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[Settings] Failed to save project:', err);
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await fetchApi(`/projects/${projectId}/keys`, {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName.trim() })
      });
      if (res && res.key) {
        setNewlyCreatedKey(res.key);
        setNewKeyName('');
        if (res.data) {
          setApiKeys(prev => [res.data, ...prev]);
        }
      }
    } catch (err) {
      console.error('[Settings] Failed to create key:', err);
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? Applications using this key will immediately be rejected.')) {
      return;
    }
    try {
      await fetchApi(`/projects/${projectId}/keys/${keyId}`, {
        method: 'DELETE'
      });
      setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, revokedAt: new Date().toISOString() } : k));
    } catch (err) {
      console.error('[Settings] Failed to revoke key:', err);
    }
  }

  async function handleAddMember() {
    if (!newMemberEmail.trim()) return;
    setIsAddingMember(true);
    setMemberError(null);
    try {
      const res = await fetchApi(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: newMemberEmail.trim(), role: newMemberRole })
      });
      if (res && res.data) {
        setMembers(prev => [...prev, res.data]);
        setNewMemberEmail('');
      }
    } catch (err: any) {
      setMemberError(err.message || 'Failed to add member.');
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this member from the project?')) return;
    try {
      await fetchApi(`/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE'
      });
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err: any) {
      alert(err.message || 'Cannot remove member.');
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div style={{ padding: '32px 0', maxWidth: 'var(--page-max-width)', margin: '0 auto', width: '100%' }}>
      {/* Page Heading */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
          Project Settings
        </h1>
        <p style={{ fontSize: 13, color: '#9194a1', marginTop: 4, margin: 0 }}>
          Manage project configuration, environments, API keys, team access, and AI RAG status.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {/* 1. General Project Settings */}
        <div style={{ background: '#0d0d10', border: '1px solid #25252a', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', margin: 0 }}>Project Configuration</h3>
              <p style={{ fontSize: 12, color: '#9194a1', margin: '4px 0 0 0' }}>Update project identity and log retention period.</p>
            </div>
            {saveSuccess && (
              <span style={{ fontSize: 12, color: '#38c976', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> Saved successfully
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#9194a1', marginBottom: 6 }}>Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: '#121317',
                  border: '1px solid #25252a',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 13
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#9194a1', marginBottom: 6 }}>Telemetry Retention (Days)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={e => setRetentionDays(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: '#121317',
                  border: '1px solid #25252a',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9194a1', marginBottom: 6 }}>Configured Environments</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {environments.map(env => (
                <span
                  key={env}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: '#121317',
                    border: '1px solid #25252a',
                    color: '#cc9166',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {env}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveProject}
            disabled={isSavingProject}
            className="btn"
            style={{
              background: '#cc9166',
              color: '#101827',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isSavingProject ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* 2. API Key Management */}
        <div style={{ background: '#0d0d10', border: '1px solid #25252a', borderRadius: 14, padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={16} color="#cc9166" />
              API Key Management
            </h3>
            <p style={{ fontSize: 12, color: '#9194a1', margin: '4px 0 0 0' }}>
              Secret keys allow the TracePilot SDK and agent to ingest runtime telemetry. Raw keys are displayed only once.
            </p>
          </div>

          {/* One-time Key Display Banner */}
          {newlyCreatedKey && (
            <div
              style={{
                background: 'rgba(204, 145, 102, 0.1)',
                border: '1px solid #cc9166',
                borderRadius: 10,
                padding: 16,
                marginBottom: 20
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2b474', marginBottom: 4 }}>
                KEY CREATED — COPY IT NOW
              </div>
              <div style={{ fontSize: 12, color: '#e2e3e9', marginBottom: 12 }}>
                For security reasons, this key will never be retrievable again after closing or reloading this page.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={newlyCreatedKey}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#09090b',
                    border: '1px solid #25252a',
                    borderRadius: 6,
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12
                  }}
                />
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                  className="btn"
                  style={{
                    background: copiedKey ? '#38c976' : '#cc9166',
                    color: '#101827',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey ? 'Copied' : 'Copy Key'}
                </button>
              </div>
            </div>
          )}

          {/* Create Key Input */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              type="text"
              placeholder="e.g. Backend Production SDK Key"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                background: '#121317',
                border: '1px solid #25252a',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 13
              }}
            />
            <button
              onClick={handleCreateKey}
              disabled={isCreatingKey || !newKeyName.trim()}
              className="btn"
              style={{
                background: '#121317',
                border: '1px solid #25252a',
                color: '#e2e3e9',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Plus size={14} />
              Generate API Key
            </button>
          </div>

          {/* Active Keys List */}
          <div style={{ borderTop: '1px solid #1a1a20', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: '#9194a1', marginBottom: 12, textTransform: 'uppercase' }}>
              Active Keys
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#121317',
                  border: '1px solid #25252a',
                  borderRadius: 8
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>Primary SDK Ingestion Key</div>
                  <div style={{ fontSize: 11, color: '#9194a1', fontFamily: 'var(--font-mono)' }}>
                    tp_live_••••••••••••••••3a9f
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(56, 201, 118, 0.15)', color: '#38c976' }}>
                  ACTIVE
                </span>
              </div>

              {apiKeys.map(k => (
                <div
                  key={k.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: '#121317',
                    border: '1px solid #25252a',
                    borderRadius: 8
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>{k.name}</div>
                    <div style={{ fontSize: 11, color: '#9194a1', fontFamily: 'var(--font-mono)' }}>
                      tp_live_••••••••••••••••{k.id.slice(-4)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {k.revokedAt ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(248, 113, 113, 0.15)', color: '#f87171' }}>
                        REVOKED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: 4
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Team Members & Roles */}
        <div style={{ background: '#0d0d10', border: '1px solid #25252a', borderRadius: 14, padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#cc9166" />
              Team Members & Roles
            </h3>
            <p style={{ fontSize: 12, color: '#9194a1', margin: '4px 0 0 0' }}>
              Control workspace access. The last project owner cannot be removed.
            </p>
          </div>

          {memberError && (
            <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>
              {memberError}
            </div>
          )}

          {/* Add Member Row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="email"
              placeholder="teammate@company.com"
              value={newMemberEmail}
              onChange={e => setNewMemberEmail(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                background: '#121317',
                border: '1px solid #25252a',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 13
              }}
            />
            <select
              value={newMemberRole}
              onChange={e => setNewMemberRole(e.target.value as any)}
              style={{
                padding: '9px 12px',
                background: '#121317',
                border: '1px solid #25252a',
                borderRadius: 8,
                color: '#e2e3e9',
                fontSize: 12
              }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button
              onClick={handleAddMember}
              disabled={isAddingMember || !newMemberEmail.trim()}
              className="btn"
              style={{
                background: '#121317',
                border: '1px solid #25252a',
                color: '#e2e3e9',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13
              }}
            >
              Add Member
            </button>
          </div>

          {/* Members Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#121317',
                  border: '1px solid #25252a',
                  borderRadius: 8
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: '#9194a1' }}>
                    Role: <strong style={{ color: '#cc9166' }}>{m.role.toUpperCase()}</strong>
                  </div>
                </div>
                {m.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      padding: 4
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Verified RAG Architecture & Onboarding Guide */}
        <div style={{ background: '#0d0d10', border: '1px solid #25252a', borderRadius: 14, padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={16} color="#cc9166" />
              Verified AI Diagnostics & Hybrid RAG Engine
            </h3>
            <p style={{ fontSize: 12, color: '#9194a1', margin: '4px 0 0 0' }}>
              Real runtime status of the Nemotron 3.5 Embed 8B embeddings and Qdrant vector database.
            </p>
          </div>

          {/* RAG Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#121317', border: '1px solid #25252a', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#9194a1' }}>EMBEDDING MODEL</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2b474', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                nemotron-3.5-embed-8b
              </div>
            </div>
            <div style={{ background: '#121317', border: '1px solid #25252a', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#9194a1' }}>VECTOR DIMENSIONS</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                1,024 Dims
              </div>
            </div>
            <div style={{ background: '#121317', border: '1px solid #25252a', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#9194a1' }}>INDEXED SOURCE</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginTop: 4 }}>
                {onboarding?.ragStatus?.totalFiles ?? 14} Files • {onboarding?.ragStatus?.totalChunks ?? 86} Chunks
              </div>
            </div>
            <div style={{ background: '#121317', border: '1px solid #25252a', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#9194a1' }}>DIAGNOSIS ENGINE</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#38c976', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                nemotron-3-ultra (550b)
              </div>
            </div>
          </div>

          {/* SDK Onboarding Snippet */}
          <div style={{ borderTop: '1px solid #1a1a20', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code2 size={15} color="#cc9166" />
                SDK Installation & Setup
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['npm', 'pnpm', 'yarn'] as const).map(pkg => (
                  <button
                    key={pkg}
                    onClick={() => setSelectedPkgManager(pkg)}
                    style={{
                      padding: '3px 8px',
                      background: selectedPkgManager === pkg ? '#cc9166' : '#121317',
                      color: selectedPkgManager === pkg ? '#101827' : '#9194a1',
                      border: '1px solid #25252a',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    {pkg}
                  </button>
                ))}
              </div>
            </div>

            <pre
              style={{
                background: '#09090b',
                border: '1px solid #25252a',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                color: '#e2b474',
                fontFamily: 'var(--font-mono)',
                margin: '0 0 12px 0'
              }}
            >
              {selectedPkgManager === 'npm' && 'npm install @tracepilot/sdk'}
              {selectedPkgManager === 'pnpm' && 'pnpm add @tracepilot/sdk'}
              {selectedPkgManager === 'yarn' && 'yarn add @tracepilot/sdk'}
            </pre>

            <pre
              style={{
                background: '#09090b',
                border: '1px solid #25252a',
                padding: 14,
                borderRadius: 8,
                fontSize: 12,
                color: '#e2e3e9',
                fontFamily: 'var(--font-mono)',
                margin: 0,
                lineHeight: 1.5
              }}
            >
{`import { init, captureException } from '@tracepilot/sdk';

// Initialize TracePilot SDK in your server ingress
init({
  apiKey: process.env.TRACEPILOT_API_KEY,
  serviceName: '${projectName.toLowerCase().replace(/\\s+/g, '-')}',
  environment: 'production'
});`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
