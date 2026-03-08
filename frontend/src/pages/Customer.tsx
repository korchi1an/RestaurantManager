import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MenuItem, OrderWithItems } from '../types';
import { api } from '../services/api';
import socketService from '../services/socket';
import sessionService from '../services/sessionService';
import { useCart } from '../hooks/useCart';
import MenuDisplay from '../components/MenuDisplay';
import CartDisplay from '../components/CartDisplay';
import '../styles/Customer.css';

const Customer: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [tableNumber, setTableNumber] = useState<number>(tableId ? parseInt(tableId) : 1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionOrders, setSessionOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [isQrMode, setIsQrMode] = useState<boolean>(!!tableId);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(8);
  const sessionIdRef = useRef<string | null>(null);

  const { cart, addToCart, removeFromCart, updateQuantity, getTotalPrice, clearCart } = useCart();

  useEffect(() => {
    // Check if customer is logged in (uses customer-specific keys, separate from staff auth)
    const token = localStorage.getItem('customer_auth_token');
    const name = localStorage.getItem('customer_user_name');
    const role = localStorage.getItem('customer_user_role');

    if (token && role === 'customer') {
      setIsLoggedIn(true);
      setUserName(name || 'Customer');
    }
    
    loadMenu();
    
    // If coming from QR code (tableId in URL), auto-create session
    if (tableId) {
      const initQRSession = async () => {
        try {
          const tableNum = parseInt(tableId);
          setTableNumber(tableNum);
          setIsQrMode(true);
          
          // Create new session for this QR code scan
          const session = await sessionService.createSession(tableNum);
          setSessionId(session.sessionId);
        } catch (error) {
          console.error('Failed to create session:', error);
        }
      };
      
      initQRSession();
    } else {
      // Check for existing session (manual mode)
      const storedSession = sessionService.getStoredSession();
      if (storedSession) {
        setSessionId(storedSession.sessionId);
        setTableNumber(storedSession.tableNumber);
      }
    }
  }, [tableId]);

  // Keep ref in sync with sessionId so socket callbacks avoid stale closures
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    // Connect socket once on mount
    socketService.connect();

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

      // Update order in sessionOrders array
      setSessionOrders(prev =>
        prev.map(o => o.id === orderWithNumbers.id ? orderWithNumbers : o)
      );
    });

    socketService.onOrderPaid((order) => {
      // Only react if this payment belongs to our session
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || order.sessionId !== currentSessionId) return;
      sessionService.clearStoredSession();
      setIsPaid(true);
    });

    socketService.onSessionEnded((data) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || data.sessionId !== currentSessionId) return;
      sessionService.clearStoredSession();
      setIsPaid(true);
    });

    return () => {
      socketService.off('orderUpdated');
      socketService.off('orderPaid');
      socketService.off('sessionEnded');
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isPaid) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaid]);

  useEffect(() => {
    // Fetch all orders for this session
    const fetchSessionOrders = async () => {
      if (!sessionId) return;
      
      try {
        const orders = await api.get<OrderWithItems[]>(`/sessions/${sessionId}/orders`);
        if (orders && orders.length > 0) {
          // Convert price strings to numbers (PostgreSQL returns DECIMAL as string)
          const ordersWithNumbers = orders.map(order => ({
            ...order,
            totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
            items: order.items.map(item => ({
              ...item,
              price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
            }))
          }));
          // Sort by newest first
          const sorted = ordersWithNumbers.sort((a, b) => b.id - a.id);
          setSessionOrders(sorted);
        }
      } catch (error) {
        // Silently fail - orders will show empty
      }
    };

    fetchSessionOrders();
  }, [sessionId]);

  useEffect(() => {
    // Heartbeat to keep session alive
    const heartbeatInterval = setInterval(() => {
      if (sessionId) {
        sessionService.heartbeat(sessionId);
      }
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [sessionId]);

  const loadMenu = async () => {
    try {
      const [items, cats] = await Promise.all([
        api.getMenu(),
        api.getCategories()
      ]);
      // Convert price strings to numbers (PostgreSQL returns DECIMAL as string)
      const itemsWithNumberPrices = items.map(item => ({
        ...item,
        price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
      }));
      setMenuItems(itemsWithNumberPrices);
      setCategories(['All', ...cats]);
    } catch (error) {
      alert('Failed to load menu. Please refresh the page.');
    }
  };



  const handleTableChange = async (newTableNumber: number) => {
    try {
      // End previous session if exists
      if (sessionId) {
        await sessionService.endSession(sessionId);
      }

      // Create new session for new table
      const session = await sessionService.createSession(newTableNumber);
      setSessionId(session.sessionId);
      setTableNumber(newTableNumber);
      clearCart();
      setSessionOrders([]);
    } catch (error) {
      alert('Failed to switch table');
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    setLoading(true);
    try {
      // For customer ordering, create session if not exists
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const session = await sessionService.createSession(tableNumber);
        currentSessionId = session.sessionId;
        setSessionId(currentSessionId);
      }

      const orderData = {
        sessionId: currentSessionId,
        tableNumber,
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity
        }))
      };
      
      // Customer orders go to /orders endpoint
      const order = await api.createOrder(orderData);
      
      // Add to session orders list at the top
      setSessionOrders(prev => [order, ...prev]);
      
      // Clear cart to allow placing another order
      clearCart();
      
      alert('✅ Order placed successfully!');
      
      // Keep session active for additional orders
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit order';
      alert('❌ Order failed: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: number) => {
    if (!confirm('Sunteți sigur că doriți să anulați această comandă?')) {
      return;
    }

    try {
      await api.cancelOrder(orderId);
      
      // Remove from session orders list
      setSessionOrders(prev => prev.filter(order => order.id !== orderId));
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      const errorMessage = error.message || 'Nu s-a putut anula comanda';
      alert(errorMessage);
    }
  };

  const handleLogout = () => {
    // Only clear customer-specific keys — never touch staff auth credentials
    localStorage.removeItem('customer_auth_token');
    localStorage.removeItem('customer_user_role');
    localStorage.removeItem('customer_user_id');
    localStorage.removeItem('customer_user_name');
    setIsLoggedIn(false);
    setUserName('');
  };

  const callWaiter = async () => {
    try {
      const customerName = userName || 'Guest';
      await api.post(`/tables/${tableNumber}/call-waiter`, { customerName });
      alert('🔔 Waiter has been notified!');
    } catch (error: any) {
      console.error('Error calling waiter:', error);
      alert('Failed to call waiter. Please try again.');
    }
  };

  if (isPaid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', textAlign: 'center', gap: '16px' }}>
        <div style={{ fontSize: '64px' }}>✅</div>
        <h1 style={{ margin: 0 }}>Mulțumim!</h1>
        <p style={{ margin: 0, fontSize: '18px' }}>Comanda a fost plătită. Vă așteptăm cu drag!</p>
        <p style={{ margin: 0, color: '#888' }}>Această pagină se va reîncărca în {countdown} secunde...</p>
      </div>
    );
  }

  return (
    <div className="customer-container">
      <header className="customer-header">
        <h1>Meniu Restaurant</h1>
        <div className="header-actions">
          <div className="table-selector">
            {isQrMode ? (
              <div className="table-info">
                <strong>Masa {tableNumber}</strong>
              </div>
            ) : (
              <>
                <label>Numărul Mesei: </label>
                <select value={tableNumber} onChange={(e) => handleTableChange(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>Masa {num}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <button 
            className="call-waiter-btn" 
            onClick={callWaiter}
            title="Call your waiter"
          >
            🔔 Call Waiter
          </button>
          <div className="auth-section">
              {isLoggedIn ? (
                <button className="logout-btn" onClick={handleLogout}>Deconectare</button>
              ) : (
                <div className="auth-buttons">
                  <button 
                    className="login-btn" 
                    onClick={() => navigate('/customer-login', { state: { tableId } })}
                  >
                    Login
                  </button>
                  <button 
                    className="register-btn" 
                    onClick={() => navigate('/customer-register', { state: { tableId } })}
                  >
                    Înregistrare
                  </button>
                </div>
              )}
          </div>
        </div>
      </header>

      {isLoggedIn && (
        <div className="welcome-message">
          Bună, {userName.split(' ')[0]}! 👋 Bucură-te de mesele noastre delicioase.
        </div>
      )}

      {sessionOrders.length > 0 && (
        <div className="order-history-section">
          <h2 className="history-title">Comenzile Tale din Sesiunea Curentă</h2>
          <div className="session-total">
            <span className="total-label">Total Sesiune:</span>
            <span className="total-amount">
              {sessionOrders.reduce((sum, order) => sum + (typeof order.totalPrice === 'number' ? order.totalPrice : 0), 0).toFixed(2)} Lei
            </span>
          </div>
          {sessionOrders.map((order) => (
            <div key={order.id} className="order-status-card">
              <h3>Comanda #{order.orderNumber}</h3>
              <div className="status-info">
                <span className={`status-badge status-${order.status.toLowerCase()}`}>
                  {order.status === 'Pending' && '⏳ În Așteptare'}
                  {order.status === 'Preparing' && '👨‍🍳 Se Pregătește'}
                  {order.status === 'Ready' && '✅ Gata'}
                  {order.status === 'Served' && '🍽️ Servit'}
                  {order.status === 'Paid' && '💰 Plătit'}
                </span>
                <span className="order-total">{(typeof order.totalPrice === 'number' ? order.totalPrice : 0).toFixed(2)} Lei</span>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="order-items-summary">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item-line">
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                </div>
              )}
              {order.status === 'Pending' && (
                <button 
                  className="cancel-order-btn" 
                  onClick={() => cancelOrder(order.id)}
                >
                  ✕ Anulează Comanda
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="customer-content">
        <div className="cart-section">
          <h2>Coșul Meu</h2>
          <CartDisplay
            cart={cart}
            onRemove={removeFromCart}
            onUpdateQuantity={updateQuantity}
            totalPrice={getTotalPrice()}
            onSubmit={submitOrder}
            loading={loading}
            submitButtonText="Trimite Comanda"
            showSessionInfo={!!sessionId}
          />
        </div>

        <div className="menu-section">
          <MenuDisplay
            menuItems={menuItems}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onAddToCart={addToCart}
          />
        </div>
      </div>
    </div>
  );
};

export default Customer;
