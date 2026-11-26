import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import { UploadTraceModal } from '../components/UploadTraceModal';
import { fetchApi } from '../api';

function safeFormatDistance(dateValue: any) {
  if (!dateValue) return 'Unknown';
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return 'Unknown';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch (e) {
    return 'Unknown';
  }
}

export default function Incidents() {
  const { incidents: initialIncidents, loading: contextLoading, error, retry } = useAppContext();
  const navigate = useNavigate();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [environmentFilter, setEnvironmentFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [filteredIncidents, setFilteredIncidents] = useState<any[]>(initialIncidents);
  const [isFetching, setIsFetching] = useState(false);

  // Query server or filter locally with fallback
  useEffect(() => {
    let isMounted = true;
    async function fetchFiltered() {
      setIsFetching(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.append('search', search.trim());
        if (statusFilter !== 'ALL') params.append('status', statusFilter.toLowerCase());
        if (environmentFilter !== 'ALL') params.append('environment', environmentFilter.toLowerCase());
        if (serviceFilter !== 'ALL') params.append('service', serviceFilter);
        params.append('limit', '50');

        const res = await fetchApi(`/incidents?${params.toString()}`);
        if (isMounted && res && Array.isArray(res.data)) {
          setFilteredIncidents(res.data);
          return;
        }
      } catch (err) {
        console.warn('[Incidents] Server filter failed, falling back to client filter:', err);
      } finally {
        if (isMounted) setIsFetching(false);
      }

      // Client-side fallback filter
      let result = initialIncidents;
      if (search.trim()) {
        const q = search.toLowerCase();
        result = result.filter(i =>
          (i.message && i.message.toLowerCase().includes(q)) ||
          (i.exceptionType && i.exceptionType.toLowerCase().includes(q)) ||
          (i.service && i.service.toLowerCase().includes(q))
        );
      }
      if (statusFilter !== 'ALL') {
        result = result.filter(i => (i.status || 'open').toLowerCase() === statusFilter.toLowerCase());
      }
      if (environmentFilter !== 'ALL') {
        result = result.filter(i => (i.environment || 'production').toLowerCase() === environmentFilter.toLowerCase());
      }
      if (serviceFilter !== 'ALL') {
        result = result.filter(i => (i.service || 'UserService') === serviceFilter);
      }
      if (isMounted) {
        setFilteredIncidents(result);
        setIsFetching(false);
      }
    }

    const timer = setTimeout(() => {
      fetchFiltered();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [search, statusFilter, environmentFilter, serviceFilter, initialIncidents]);

  const uniqueServices = useMemo(() => {
    const set = new Set<string>();
    initialIncidents.forEach(inc => {
      if (inc.service) set.add(inc.service);
    });
    if (set.size === 0) {
      ['UserService', 'API Gateway', 'PaymentService', 'NotificationService'].forEach(s => set.add(s));
    }
    return Array.from(set);
  }, [initialIncidents]);

  if (contextLoading && !initialIncidents.length) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ border: '2px solid var(--color-ash-stroke)', borderTopColor: 'var(--color-bone)', borderRadius: '50%', width: 24, height: 24 }}></div>
        <div className="empty-state-title">Loading incidents...</div>
      </div>
    );
  }

  if (error && !initialIncidents.length) {
    return (
      <div className="empty-state" style={{ borderColor: 'var(--color-signal-orange)' }}>
        <div style={{ color: 'var(--color-signal-orange)', marginBottom: 16 }}>CONNECTION_FAILED</div>
        <div className="empty-state-title">Unable to connect to TracePilot API</div>
        <p style={{ marginBottom: 24 }}>{error}</p>
        <button className="btn btn-primary" onClick={retry}>RETRY_CONNECTION</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <div className="text-heading">Incidents</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-warm-granite)', textTransform: 'uppercase' }}>
            {filteredIncidents.length} RECORDS {isFetching ? '(FILTERING...)' : ''}
          </div>
          <button 
            className="btn btn-primary" 
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setIsUploadModalOpen(true)}
          >
            + UPLOAD TRACE
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Search exceptions by message, type, or service..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'transparent', 
            border: '1px solid var(--color-ash-stroke)', 
            color: 'var(--color-bone)', 
            padding: '8px 12px',
            borderRadius: 'var(--radius-buttons)',
            fontFamily: 'var(--font-geist)',
            fontSize: 14,
            flex: 1,
            minWidth: 200
          }} 
        />
        <select 
          className="filter-select" 
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: 'transparent', border: '1px solid var(--color-ash-stroke)', color: 'var(--color-warm-granite)', padding: '8px 12px', borderRadius: 'var(--radius-buttons)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase'
          }}
        >
          <option value="ALL">STATUS: ALL</option>
          <option value="OPEN">STATUS: OPEN</option>
          <option value="INVESTIGATING">STATUS: INVESTIGATING</option>
          <option value="RESOLVED">STATUS: RESOLVED</option>
        </select>
        <select 
          className="filter-select" 
          value={environmentFilter}
          onChange={e => setEnvironmentFilter(e.target.value)}
          style={{
            background: 'transparent', border: '1px solid var(--color-ash-stroke)', color: 'var(--color-warm-granite)', padding: '8px 12px', borderRadius: 'var(--radius-buttons)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase'
          }}
        >
          <option value="ALL">ENVIRONMENT: ALL</option>
          <option value="PRODUCTION">PRODUCTION</option>
          <option value="STAGING">STAGING</option>
          <option value="DEVELOPMENT">DEVELOPMENT</option>
        </select>
        <select 
          className="filter-select" 
          value={serviceFilter}
          onChange={e => setServiceFilter(e.target.value)}
          style={{
            background: 'transparent', border: '1px solid var(--color-ash-stroke)', color: 'var(--color-warm-granite)', padding: '8px 12px', borderRadius: 'var(--radius-buttons)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase'
          }}
        >
          <option value="ALL">SERVICE: ALL</option>
          {uniqueServices.map(s => (
            <option key={s} value={s}>{s.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>STATUS</th>
                <th>ERROR</th>
                <th>SERVICE</th>
                <th>ENVIRONMENT</th>
                <th>OCCURRENCES</th>
                <th>LAST SEEN</th>
                <th>FIRST SEEN</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((inc: any) => {
                const serviceName = inc.service || inc.context?.service || 'UserService';
                const occurrences = inc.occurrences || 1;
                const lastSeen = inc.lastSeenAt || inc.occurredAt;
                const firstSeen = inc.occurredAt;
                const isResolved = inc.status === 'resolved';

                return (
                  <tr 
                    key={inc.id} 
                    className="incident-row"
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                  >
                    <td>
                      <span className={`badge ${isResolved ? 'resolved' : 'unresolved'}`}>
                        {inc.status || 'open'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)', marginBottom: 4 }}>{inc.exceptionType || 'Error'}</div>
                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-warm-granite)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{inc.message}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>
                      {serviceName}
                    </td>
                    <td>
                      <span className="badge">
                        {inc.environment || 'production'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>
                      {occurrences.toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>{safeFormatDistance(lastSeen)}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>{safeFormatDistance(firstSeen)}</div>
                    </td>
                  </tr>
                );
              })}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-warm-granite)' }}>
                    No matching incidents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UploadTraceModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onSuccess={(newId) => {
          setIsUploadModalOpen(false);
          retry();
          navigate(`/incidents/${newId}`);
        }} 
      />
    </div>
  );
}
