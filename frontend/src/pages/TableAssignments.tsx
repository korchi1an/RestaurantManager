import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import '../styles/TableAssignments.css';

interface Table {
  id: number;
  table_number: number;
  capacity: number;
  status: string;
  waiter_id: number | null;
  waiter_username?: string;
  waiter_name?: string;
}

interface Waiter {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

const TableAssignments: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tablesData, waitersData] = await Promise.all([
        api.get<Table[]>('/table-assignments'),
        api.get<Waiter[]>('/table-assignments/waiters')
      ]);
      setTables(tablesData);
      setWaiters(waitersData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load table assignments');
    }
  };

  const handleAssign = async (tableId: number, waiterId: number) => {
    setLoading(true);
    try {
      await api.patch(`/table-assignments/${tableId}/assign`, { waiterId });
      await loadData();
    } catch (error) {
      console.error('Error assigning table:', error);
      alert('Failed to assign table');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (tableId: number) => {
    setLoading(true);
    try {
      await api.patch(`/table-assignments/${tableId}/unassign`, {});
      await loadData();
    } catch (error) {
      console.error('Error unassigning table:', error);
      alert('Failed to unassign table');
    } finally {
      setLoading(false);
    }
  };

  const getWaiterStats = (waiterId: number) => {
    return tables.filter(t => t.waiter_id === waiterId).length;
  };

  return (
    <div className="table-assignments-container">
      <header className="assignments-header">
        <h1>Managementul Meselor</h1>
        <button className="refresh-btn" onClick={loadData} disabled={loading}>
          Actualizează
        </button>
      </header>

      <div className="assignments-content">
        <section className="waiters-section">
          <h2>Chelneri</h2>
          <div className="waiters-list">
            {waiters.map(waiter => (
              <div key={waiter.id} className="waiter-card">
                <div className="waiter-info">
                  <h3>{waiter.full_name}</h3>
                  <span className="waiter-username">@{waiter.username}</span>
                </div>
                <div className="waiter-stats">
                  <span className="table-count">{getWaiterStats(waiter.id)} mese</span>
                </div>
              </div>
            ))}
            {waiters.length === 0 && (
              <p className="no-data">Niciun chelner înregistrat</p>
            )}
          </div>
        </section>

        <section className="tables-section">
          <h2>Mese ({tables.length})</h2>
          <div className="tables-grid">
            {tables.map(table => (
              <div key={table.id} className="table-card">
                <div className="table-header">
                  <h3>Masa {table.table_number}</h3>
                  <span className="table-capacity">{table.capacity} locuri</span>
                </div>
                
                <div className="table-assignment">
                  {table.waiter_id ? (
                    <div className="assigned-waiter">
                      <div className="waiter-details">
                        <span className="assigned-label">Alocat:</span>
                        <span className="waiter-name">{table.waiter_name}</span>
                      </div>
                      <button
                        className="unassign-btn"
                        onClick={() => handleUnassign(table.id)}
                        disabled={loading}
                      >
                        Șterge
                      </button>
                    </div>
                  ) : (
                    <div className="assign-controls">
                      <select
                        className="waiter-select"
                        onChange={(e) => {
                          const waiterId = parseInt(e.target.value);
                          if (waiterId) {
                            handleAssign(table.id, waiterId);
                            e.target.value = '';
                          }
                        }}
                        disabled={loading}
                      >
                        <option value="">Selectează chelner...</option>
                        {waiters.map(waiter => (
                          <option key={waiter.id} value={waiter.id}>
                            {waiter.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TableAssignments;
