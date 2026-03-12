import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderWithItems } from '../types';
import { api } from '../services/api';
import socketService from '../services/socket';
import '../styles/Kitchen.css';

const Kitchen: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadOrders();
    socketService.connect();

    socketService.onOrderCreated((order) => {
      const orderWithNumbers = {
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: order.items.map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      };
      setOrders(prev => [orderWithNumbers, ...prev]);
      playNotificationSound();
    });

    socketService.onOrderUpdated((order) => {
      const orderWithNumbers = {
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: order.items.map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      };

      if (orderWithNumbers.status === 'Served' || orderWithNumbers.status === 'Paid') {
        setOrders(prev => prev.filter(o => o.id !== orderWithNumbers.id));
      } else {
        setOrders(prev => prev.map(o => o.id === orderWithNumbers.id ? orderWithNumbers : o));
      }
    });

    socketService.onOrderCancelled((data: { orderId: number }) => {
      setOrders(prev => prev.filter(o => o.id !== data.orderId));
    });

    return () => {
      socketService.off('orderCreated');
      socketService.off('orderUpdated');
      socketService.off('orderCancelled');
      socketService.disconnect();
    };
  }, []);

  const loadOrders = async () => {
    try {
      const allOrders = await api.getOrders();
      const ordersWithNumbers = allOrders.map(order => ({
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: order.items.map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      }));
      const activeOrders = ordersWithNumbers.filter(order =>
        order.status !== 'Served' &&
        order.status !== 'Paid' &&
        !order.items.every((item: any) => item.category === 'Băuturi')
      );
      setOrders(activeOrders);
    } catch (error) {
      alert('Failed to load orders. Please refresh the page.');
    }
  };

  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const markOrderAs = async (orderId: number, status: 'Preparing' | 'Ready') => {
    setLoadingOrders(prev => new Set(prev).add(orderId));
    try {
      await api.updateOrderStatus(orderId, status);
    } catch {
      alert('Failed to update order status');
    } finally {
      setLoadingOrders(prev => { const next = new Set(prev); next.delete(orderId); return next; });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#ffa500';
      case 'Preparing': return '#2196F3';
      case 'Ready': return '#4CAF50';
      default: return '#333';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': return 'În Așteptare';
      case 'Preparing': return 'În Preparare';
      case 'Ready': return 'Gata';
      default: return status;
    }
  };

  const groupedOrders = orders.reduce((acc, order) => {
    if (!acc[order.tableNumber]) {
      acc[order.tableNumber] = [];
    }
    acc[order.tableNumber].push(order);
    return acc;
  }, {} as Record<number, OrderWithItems[]>);

  // Derive a single status for a table: worst-case (Pending > Preparing > Ready)
  const getTableStatus = (tableOrders: OrderWithItems[]) => {
    if (tableOrders.some(o => o.status === 'Pending')) return 'Pending';
    if (tableOrders.some(o => o.status === 'Preparing')) return 'Preparing';
    return 'Ready';
  };

  return (
    <div className="kitchen-container">
      <header className="kitchen-header">
        <h1>Panoul Bucătăriei</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="refresh-btn"
            onClick={() => navigate('/assignments')}
            style={{ backgroundColor: '#4CAF50' }}
          >
            Managementul Meselor
          </button>
        </div>
      </header>

      <div className="kitchen-stats">
        <div className="stat-card">
          <h3>În Așteptare</h3>
          <p className="stat-number">{orders.filter(o => o.status === 'Pending').length}</p>
        </div>
        <div className="stat-card">
          <h3>În Preparare</h3>
          <p className="stat-number">{orders.filter(o => o.status === 'Preparing').length}</p>
        </div>
        <div className="stat-card">
          <h3>Gata</h3>
          <p className="stat-number">{orders.filter(o => o.status === 'Ready').length}</p>
        </div>
      </div>

      <div className="orders-grid">
        {Object.entries(groupedOrders)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([tableNum, tableOrders]) => {
            const tableStatus = getTableStatus(tableOrders);
            const sortedWaves = [...tableOrders].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return (
              <div key={tableNum} className="table-orders">
                <div className="table-header-row">
                  <div>
                    <h2 className="table-header">Masa {tableNum}</h2>
                    <p className="wave-count">
                      {tableOrders.length} {tableOrders.length === 1 ? 'comandă' : 'comenzi'}
                    </p>
                  </div>
                  <div
                    className="order-status-badge"
                    style={{ backgroundColor: getStatusColor(tableStatus) }}
                  >
                    {getStatusLabel(tableStatus)}
                  </div>
                </div>

                {sortedWaves.map((order, index) => {
                  const isNew = order.status === 'Pending' && index === sortedWaves.length - 1 && sortedWaves.length > 1;
                  return (
                    <div
                      key={order.id}
                      className="kitchen-order-card"
                      style={{ borderLeftColor: getStatusColor(order.status) }}
                    >
                      <div className="order-header">
                        <div>
                          <h3>
                            Comanda #{order.orderNumber}
                            {isNew && <span className="wave-new-badge"> ⚡ NOU</span>}
                          </h3>
                          <p className="order-time">
                            {new Date(order.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div
                          className="order-status-badge"
                          style={{ backgroundColor: getStatusColor(order.status) }}
                        >
                          {getStatusLabel(order.status)}
                        </div>
                      </div>

                      <div className="order-items-list">
                        {order.items.map(item => (
                          <div key={item.menuItemId} className="kitchen-order-item">
                            <span className="item-quantity">{item.quantity}x</span>
                            <span className="item-name">{item.name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="wave-actions">
                        {order.status === 'Pending' && (
                          <button
                            className="btn-preparing"
                            disabled={loadingOrders.has(order.id)}
                            onClick={() => markOrderAs(order.id, 'Preparing')}
                          >
                            Începe Prepararea
                          </button>
                        )}
                        {order.status === 'Preparing' && (
                          <button
                            className="btn-ready"
                            disabled={loadingOrders.has(order.id)}
                            onClick={() => markOrderAs(order.id, 'Ready')}
                          >
                            Marchează ca Gata
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>

      {orders.length === 0 && (
        <div className="empty-state">
          <h2>Nu există comenzi active</h2>
          <p>Așteptăm comenzi noi...</p>
        </div>
      )}
    </div>
  );
};

export default Kitchen;
