import React, { useState, useEffect } from 'react';
import { OrderWithItems } from '../types';
import { api } from '../services/api';
import socketService from '../services/socket';
import '../styles/Waiter.css';

const Waiter: React.FC = () => {
  const [readyOrders, setReadyOrders] = useState<OrderWithItems[]>([]);
  const [servedOrders, setServedOrders] = useState<OrderWithItems[]>([]);
  const [assignedTables, setAssignedTables] = useState<any[]>([]);
  const [tableUnpaidTotals, setTableUnpaidTotals] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string>('');

  useEffect(() => {
    loadAssignedTables();
    loadOrders();
    loadUnpaidTotals();
    socketService.connect();

    socketService.onOrderReady((order) => {
      setReadyOrders(prev => {
        // Check if order already exists
        const exists = prev.some(o => o.id === order.id);
        if (exists) {
          return prev.map(o => o.id === order.id ? order : o);
        }
        return [...prev, order];
      });
      showNotification(`Comanda #${order.id} pentru Masa ${order.tableNumber} este gata!`);
      playNotificationSound();
    });

    socketService.onOrderUpdated((order) => {
      if (order.status === 'Ready') {
        setReadyOrders(prev => {
          const exists = prev.some(o => o.id === order.id);
          if (exists) {
            return prev.map(o => o.id === order.id ? order : o);
          }
          return [...prev, order];
        });
      } else if (order.status === 'Served') {
        setReadyOrders(prev => prev.filter(o => o.id !== order.id));
        setServedOrders(prev => [...prev, order]);
      }
    });

    return () => {
      socketService.off('orderReady');
      socketService.off('orderUpdated');
      socketService.disconnect();
    };
  }, []);

  const loadAssignedTables = async () => {
    try {
      const tables = await api.get<any[]>('/table-assignments/my-tables');
      setAssignedTables(tables);
    } catch (error) {
      console.error('Error loading assigned tables:', error);
    }
  };

  const loadUnpaidTotals = async () => {
    try {
      const tables = await api.get<any[]>('/table-assignments/my-tables');
      const totalsMap = new Map<number, number>();
      
      for (const table of tables) {
        const result = await api.get<{ tableNumber: number; unpaidTotal: number }>(`/tables/${table.table_number}/unpaid-total`);
        totalsMap.set(table.table_number, result.unpaidTotal);
      }
      
      setTableUnpaidTotals(totalsMap);
    } catch (error) {
      console.error('Error loading unpaid totals:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const allOrders = await api.getOrders();
      const ready = allOrders.filter(order => order.status === 'Ready');
      const served = allOrders.filter(order => order.status === 'Served');
      setReadyOrders(ready);
      setServedOrders(served);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 5000);
  };

  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const markAsServed = async (orderId: number) => {
    setLoading(true);
    try {
      await api.updateOrderStatus(orderId, 'Served');
      await loadUnpaidTotals(); // Reload unpaid totals after status update
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Nu s-a putut actualiza starea comenzii');
    } finally {
      setLoading(false);
    }
  };

  const markTableAsPaid = async (tableNumber: number) => {
    if (!confirm(`Marchează toate comenzile neplătite de la Masa ${tableNumber} ca plătite?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await api.post<{ success: boolean; ordersPaid: number; message: string }>(
        `/tables/${tableNumber}/mark-paid`,
        {}
      );
      showNotification(result.message);
      await loadUnpaidTotals();
      await loadOrders();
    } catch (error) {
      console.error('Error marking table as paid:', error);
      alert('Nu s-a putut marca masa ca plătită');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="waiter-container">
      <header className="waiter-header">
        <h1>Panoul Chelnerului</h1>
        <button className="refresh-btn" onClick={() => { loadOrders(); loadUnpaidTotals(); }}>Actualizează</button>
      </header>

      {assignedTables.length > 0 && (
        <div className="assigned-tables-section">
          <h3>Mesele Tale</h3>
          <div className="assigned-tables-grid">
            {assignedTables.map(table => {
              const unpaidTotal = tableUnpaidTotals.get(table.table_number) || 0;
              return (
                <div key={table.id} className="table-card">
                  <div className="table-info">
                    <h4>Masa {table.table_number}</h4>
                    <div className="table-stats">
                      {unpaidTotal > 0 ? (
                        <>
                          <span className="unpaid-badge">Neplătit: {unpaidTotal.toFixed(2)} Lei</span>
                          <button 
                            className="pay-btn"
                            onClick={() => markTableAsPaid(table.table_number)}
                            disabled={loading}
                          >
                            Marchează ca Plătit
                          </button>
                        </>
                      ) : (
                        <span className="paid-badge">Plătit ✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {assignedTables.length === 0 && (
        <div className="no-tables-warning">
          <p>⚠️ Nu ai mese alocate. Contactează managerul pentru a-ți aloca mese.</p>
        </div>
      )}

      {notification && (
        <div className="notification-banner">
          {notification}
        </div>
      )}

      <div className="waiter-stats">
        <div className="stat-card ready">
          <h3>Gata de Servit</h3>
          <p className="stat-number">{readyOrders.length}</p>
        </div>
        <div className="stat-card served">
          <h3>Servite Astăzi</h3>
          <p className="stat-number">{servedOrders.length}</p>
        </div>
      </div>

      <section className="orders-section">
        <h2 className="section-title">Comenzi Gata</h2>
        {readyOrders.length === 0 ? (
          <div className="empty-state">
            <p>Nu există comenzi gata de servit</p>
          </div>
        ) : (
          <div className="orders-grid">
            {readyOrders.map(order => (
              <div key={order.id} className="waiter-order-card ready-order">
                <div className="order-header">
                  <div>
                    <h3>Masa {order.tableNumber}</h3>
                    <p className="order-id">Comanda #{order.id}</p>
                    <p className="order-time">Gata la: {formatTime(order.updatedAt)}</p>
                  </div>
                  <div className="status-badge ready">GATA</div>
                </div>

                <div className="order-items-list">
                  {order.items.map(item => (
                    <div key={item.id} className="order-item">
                      <span className="item-quantity">{item.quantity}x</span>
                      <span className="item-name">{item.name}</span>
                    </div>
                  ))}
                </div>

                <div className="order-footer">
                  <p className="order-total">Total: {order.totalPrice.toFixed(2)} Lei</p>
                  <button 
                    className="btn-serve" 
                    onClick={() => markAsServed(order.id)}
                    disabled={loading}
                  >
                    ✓ Marchează ca Servit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="orders-section">
        <h2 className="section-title">Servite Recent</h2>
        {servedOrders.length === 0 ? (
          <div className="empty-state">
            <p>Încă nu există comenzi servite</p>
          </div>
        ) : (
          <div className="orders-list">
            {servedOrders.slice(0, 10).map(order => (
              <div key={order.id} className="served-order-item">
                <div className="served-order-info">
                  <strong>Masa {order.tableNumber}</strong>
                  <span>Comanda #{order.id}</span>
                  <span>{order.totalPrice.toFixed(2)} Lei</span>
                </div>
                <div className="served-time">{formatTime(order.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Waiter;
