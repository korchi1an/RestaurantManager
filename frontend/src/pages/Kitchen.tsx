import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderWithItems } from '../types';
import { api } from '../services/api';
import socketService from '../services/socket';
import '../styles/Kitchen.css';

const Kitchen: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadOrders();
    socketService.connect();

    socketService.onOrderCreated((order) => {
      // Convert price strings to numbers
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
      // Convert price strings to numbers
      const orderWithNumbers = {
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: order.items.map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      };
      
      if (orderWithNumbers.status === 'Served') {
        // Remove served orders from kitchen screen
        setOrders(prev => prev.filter(o => o.id !== orderWithNumbers.id));
      } else {
        // Update other orders
        setOrders(prev => prev.map(o => o.id === orderWithNumbers.id ? orderWithNumbers : o));
      }
    });

    socketService.onOrderCancelled((data: { orderId: number }) => {
      // Remove cancelled order from kitchen screen
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
      // Convert price strings to numbers
      const ordersWithNumbers = allOrders.map(order => ({
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: order.items.map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      }));
      // Filter orders that are not yet served
      const activeOrders = ordersWithNumbers.filter(order => order.status !== 'Served');
      setOrders(activeOrders);
    } catch (error) {
      alert('Failed to load orders. Please refresh the page.');
    }
  };

  const playNotificationSound = () => {
    // Simple beep sound (in production, you'd use an actual audio file)
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

  const markAsReady = async (orderId: number) => {
    setLoading(true);
    try {
      await api.updateOrderStatus(orderId, 'Ready');
    } catch (error) {
      alert('Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  const markAsPreparing = async (orderId: number) => {
    setLoading(true);
    try {
      await api.updateOrderStatus(orderId, 'Preparing');
    } catch (error) {
      alert('Failed to update order status');
    } finally {
      setLoading(false);
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const groupedOrders = orders.reduce((acc, order) => {
    if (!acc[order.tableNumber]) {
      acc[order.tableNumber] = [];
    }
    acc[order.tableNumber].push(order);
    return acc;
  }, {} as Record<number, OrderWithItems[]>);

  return (
    <div className="kitchen-container">
      <header className="kitchen-header">
        <h1>Panoul Bucătăriei</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="refresh-btn" onClick={loadOrders}>Actualizează</button>
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
          .map(([tableNum, tableOrders]) => (
            <div key={tableNum} className="table-orders">
              <h2 className="table-header">Masa {tableNum}</h2>
              {tableOrders.map(order => (
                <div key={order.id} className="kitchen-order-card">
                  <div className="order-header">
                    <div>
                      <h3>Comanda #{order.id}</h3>
                      <p className="order-time">{formatTime(order.createdAt)}</p>
                    </div>
                    <div 
                      className="order-status-badge" 
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {order.status === 'Pending' ? 'În Așteptare' : order.status === 'Preparing' ? 'În Preparare' : 'Gata'}
                    </div>
                  </div>

                  <div className="order-items-list">
                    {order.items.map(item => (
                      <div key={item.id} className="kitchen-order-item">
                        <span className="item-quantity">{item.quantity}x</span>
                        <span className="item-name">{item.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-actions">
                    {order.status === 'Pending' && (
                      <button 
                        className="btn-preparing" 
                        onClick={() => markAsPreparing(order.id)}
                        disabled={loading}
                      >
                        Începe Prepararea
                      </button>
                    )}
                    {(order.status === 'Pending' || order.status === 'Preparing') && (
                      <button 
                        className="btn-ready" 
                        onClick={() => markAsReady(order.id)}
                        disabled={loading}
                      >
                        Marchează ca Gata
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
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
