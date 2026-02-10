import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MenuItem, CartItem, OrderWithItems } from '../types';
import { api } from '../services/api';
import socketService from '../services/socket';
import sessionService from '../services/sessionService';
import '../styles/Customer.css';

const Customer: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState<number>(tableId ? parseInt(tableId) : 1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderWithItems | null>(null);
  const [sessionOrders, setSessionOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [isQrMode, setIsQrMode] = useState<boolean>(!!tableId);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    const name = localStorage.getItem('user_name');
    const role = localStorage.getItem('user_role');
    
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
          console.log('QR Code scanned - Session created:', session.sessionId);
          setSessionId(session.sessionId);
        } catch (error) {
          console.error('Error creating session from QR code:', error);
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

  useEffect(() => {
    // Connect socket once
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
      
      // Update current order if it matches
      setCurrentOrder(prev => prev && prev.id === orderWithNumbers.id ? orderWithNumbers : prev);
      
      // Update order in sessionOrders array
      setSessionOrders(prev => 
        prev.map(o => o.id === orderWithNumbers.id ? orderWithNumbers : o)
      );
    });

    return () => {
      socketService.off('orderUpdated');
      socketService.disconnect();
    };
  }, [currentOrder]);

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
        console.error('Error fetching session orders:', error);
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
      console.error('Error loading menu:', error);
    }
  };

  const filteredItems = selectedCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const addToCart = (menuItem: MenuItem) => {
    const existingItem = cart.find(item => item.menuItem.id === menuItem.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.menuItem.id === menuItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { menuItem, quantity: 1 }]);
    }
  };

  const removeFromCart = (menuItemId: number) => {
    setCart(cart.filter(item => item.menuItem.id !== menuItemId));
  };

  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
    } else {
      setCart(cart.map(item =>
        item.menuItem.id === menuItemId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.menuItem.price * item.quantity), 0);
  };

  const handleTableChange = async (newTableNumber: number) => {
    try {
      // End previous session if exists
      if (sessionId) {
        await sessionService.endSession(sessionId);
      }

      // Create new session for new table
      const session = await sessionService.createSession(newTableNumber);
      console.log('Session created:', session.sessionId);
      setSessionId(session.sessionId);
      setTableNumber(newTableNumber);
      setCart([]);
      setCurrentOrder(null);
    } catch (error) {
      console.error('Error changing table:', error);
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
      // Create session if not exists
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        console.log('Creating new session for table:', tableNumber);
        const session = await sessionService.createSession(tableNumber);
        currentSessionId = session.sessionId;
        setSessionId(currentSessionId);
        console.log('Session created:', currentSessionId);
      }

      const orderData = {
        sessionId: currentSessionId,
        tableNumber,
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity
        }))
      };

      console.log('Submitting order:', orderData);
      const order = await api.createOrder(orderData);
      console.log('Order created:', order);
      
      // Add to session orders list at the top
      setSessionOrders(prev => [order, ...prev]);
      
      // Clear cart to allow placing another order
      setCart([]);
      
      // Keep session active for additional orders
    } catch (error: any) {
      console.error('Error submitting order:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit order';
      alert(errorMessage);
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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    setIsLoggedIn(false);
    setUserName('');
  };

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
          <div className="auth-section">
            {isLoggedIn ? (
              <div className="logged-in-info">
                <span className="user-name">👤 {userName}</span>
                <button className="logout-btn" onClick={handleLogout}>Deconectare</button>
              </div>
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
          Bună, {userName}! 👋 Bucură-te de mesele noastre delicioase.
        </div>
      )}

      {sessionOrders.length > 0 && (
        <div className="order-history-section">
          <h2 className="history-title">Comenzile Tale din Sesiunea Curentă</h2>
          <div className="session-total">
            <span className="total-label">Total Sesiune:</span>
            <span className="total-amount">
              {sessionOrders.reduce((sum, order) => sum + order.totalPrice, 0).toFixed(2)} Lei
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
                </span>
                <span className="order-total">{order.totalPrice.toFixed(2)} Lei</span>
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
          {cart.length === 0 ? (
            <p className="empty-cart">Coșul este gol</p>
          ) : (
            <>
              <div className="cart-items">
                {cart.map(item => (
                  <div key={item.menuItem.id} className="cart-item">
                    <div className="cart-item-info">
                      <h4>{item.menuItem.name}</h4>
                      <p>{item.menuItem.price.toFixed(2)} Lei</p>
                    </div>
                    <div className="cart-item-controls">
                      <button onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}>+</button>
                      <button className="remove-btn" onClick={() => removeFromCart(item.menuItem.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-total">
                <h3>Total: {getTotalPrice().toFixed(2)} Lei</h3>
                <button 
                  className="submit-order-btn" 
                  onClick={submitOrder}
                  disabled={loading}
                >
                  {loading ? 'Se trimite...' : 'Trimite Comanda'}
                </button>
                {sessionId && (
                  <p className="session-info">Sesiune activă - Puteți plasa comenzi multiple</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="menu-section">
          <div className="category-tabs">
            {categories.map(category => (
              <button
                key={category}
                className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {filteredItems.map(item => (
              <div key={item.id} className="menu-item-card">
                <div className="menu-item-info">
                  <h3>{item.name}</h3>
                  <p className="menu-item-description">{item.description}</p>
                  <p className="menu-item-price">{item.price.toFixed(2)} Lei</p>
                </div>
                <button className="add-to-cart-btn" onClick={() => addToCart(item)}>
                  Adaugă în Coș
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Customer;
