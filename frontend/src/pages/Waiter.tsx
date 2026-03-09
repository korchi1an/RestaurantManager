import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { OrderWithItems, MenuItem } from '../types';
import { api } from '../services/api';
import socketService from '../services/socket';
import { useCart } from '../hooks/useCart';
import MenuDisplay from '../components/MenuDisplay';
import CartDisplay from '../components/CartDisplay';
import '../styles/Waiter.css';

const Waiter: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [readyOrders, setReadyOrders] = useState<OrderWithItems[]>([]);
  const [assignedTables, setAssignedTables] = useState<any[]>([]);
  const [tableUnpaidTotals, setTableUnpaidTotals] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string>('');
  const [waiterCalls, setWaiterCalls] = useState<{ tableNumber: number; customerName: string; timestamp: string }[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Inline order form state
  const [isOrdering, setIsOrdering] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Toate');
  const [orderTableNumber, setOrderTableNumber] = useState<number>(1);
  const [orderLoading, setOrderLoading] = useState(false);
  const { cart, addToCart, removeFromCart, updateQuantity, getTotalPrice, clearCart } = useCart();

  // Use ref to access latest assignedTables in socket listener
  const assignedTablesRef = React.useRef<any[]>([]);
  const isLoadingUnpaidTotalsRef = React.useRef<boolean>(false);

  useEffect(() => {
    assignedTablesRef.current = assignedTables;
  }, [assignedTables]);

  useEffect(() => {
    // Check for success message from order placement
    const state = location.state as { orderSuccess?: boolean; message?: string };
    if (state?.orderSuccess) {
      setSuccessMessage(state.message || 'Order placed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }

    loadOrders();
    loadUnpaidTotals();
    socketService.connect();

    socketService.onOrderReady((order) => {
      // Convert price fields from string to number (PostgreSQL DECIMAL type)
      const convertedOrder = {
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: (order.items || []).map(item => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      };

      setReadyOrders(prev => {
        // Check if order already exists
        const exists = prev.some(o => o.id === convertedOrder.id);
        if (exists) {
          return prev.map(o => o.id === convertedOrder.id ? convertedOrder : o);
        }
        return [...prev, convertedOrder];
      });
      showNotification(`Comanda #${order.id} pentru Masa ${order.tableNumber} este gata!`);
      playNotificationSound();
    });

    socketService.onOrderUpdated(async (order) => {
      console.log('[Waiter] Socket orderUpdated received:', { orderId: order.id, status: order.status, tableNumber: order.tableNumber });

      // Convert price strings to numbers
      const orderWithNumbers = {
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: (order.items || []).map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      };

      if (orderWithNumbers.status === 'Ready') {
        setReadyOrders(prev => {
          const exists = prev.some(o => o.id === orderWithNumbers.id);
          if (exists) {
            return prev.map(o => o.id === orderWithNumbers.id ? orderWithNumbers : o);
          }
          return [...prev, orderWithNumbers];
        });
      } else if (orderWithNumbers.status === 'Served' || orderWithNumbers.status === 'Paid') {
        // Remove from ready orders
        setReadyOrders(prev => prev.filter(o => o.id !== orderWithNumbers.id));

        // Fetch fresh unpaid total for this table from backend
        try {
          const result = await api.get<{ tableNumber: number; unpaidTotal: number }>(`/tables/${orderWithNumbers.tableNumber}/unpaid-total`);
          const unpaidTotal = typeof result.unpaidTotal === 'string' ? parseFloat(result.unpaidTotal) : result.unpaidTotal;

          setTableUnpaidTotals(prev => {
            const newMap = new Map(prev);
            newMap.set(orderWithNumbers.tableNumber, unpaidTotal);
            console.log(`[Waiter] Socket: Refreshed unpaid total for table ${orderWithNumbers.tableNumber}: ${unpaidTotal}`);
            return newMap;
          });
        } catch (error) {
          console.error('[Waiter] Failed to refresh unpaid total:', error);
        }
      }
    });

    socketService.onWaiterCalled((data) => {
      // Check if this waiter is assigned to the called table (use ref for latest value)
      const isAssigned = assignedTablesRef.current.some(table => table.table_number === data.tableNumber);

      if ((import.meta as any).env?.DEV) {
        console.log('Waiter called event received:', {
          tableNumber: data.tableNumber,
          assignedTables: assignedTablesRef.current.map(t => t.table_number),
          isAssigned
        });
      }

      if (isAssigned) {
        setWaiterCalls(prev => [...prev, {
          tableNumber: data.tableNumber,
          customerName: data.customerName,
          timestamp: data.timestamp || new Date().toISOString()
        }]);
        playNotificationSound();
        // Alerts stack and stay visible until manually closed
      }
    });

    return () => {
      socketService.off('orderReady');
      socketService.off('orderUpdated');
      socketService.off('waiter-called');
      socketService.disconnect();
    };
  }, []); // Remove assignedTables dependency - we use ref instead

  const loadUnpaidTotals = async () => {
    if (isLoadingUnpaidTotalsRef.current) {
      console.log('[Waiter] loadUnpaidTotals already in progress, skipping...');
      return;
    }

    try {
      isLoadingUnpaidTotalsRef.current = true;
      console.log('[Waiter] Loading unpaid totals...');
      const tables = await api.get<any[]>('/table-assignments/my-tables');
      console.log('[Waiter] Assigned tables received:', tables.length, tables);
      const totalsMap = new Map<number, number>();

      for (const table of tables) {
        const result = await api.get<{ tableNumber: number; unpaidTotal: number }>(`/tables/${table.table_number}/unpaid-total`);
        // Convert string to number if needed
        const unpaidTotal = typeof result.unpaidTotal === 'string' ? parseFloat(result.unpaidTotal) : result.unpaidTotal;
        console.log(`[Waiter] Table ${table.table_number} unpaid total:`, unpaidTotal);
        totalsMap.set(table.table_number, unpaidTotal);
      }

      console.log('[Waiter] Updating state with new totals:', Array.from(totalsMap.entries()));

      // Update both assigned tables and unpaid totals to keep them in sync
      setAssignedTables([...tables]); // Force new array instance
      setTableUnpaidTotals(new Map(totalsMap)); // Force new Map instance to trigger re-render
      // Update ref for socket handlers
      assignedTablesRef.current = tables;
    } catch (error) {
      console.error('[Waiter] Error loading unpaid totals:', error);
    } finally {
      isLoadingUnpaidTotalsRef.current = false;
    }
  };

  const loadOrders = async () => {
    try {
      const allOrders = await api.getOrders();
      // Convert price strings to numbers
      const ordersWithNumbers = allOrders.map(order => ({
        ...order,
        totalPrice: typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : order.totalPrice,
        items: (order.items || []).map((item: any) => ({
          ...item,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
        }))
      }));
      const ready = ordersWithNumbers.filter(order => order.status === 'Ready');
      setReadyOrders(ready);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  // ── Inline order form ────────────────────────────────────────────────────────

  const openOrderForm = async () => {
    setOrderTableNumber(assignedTables[0]?.table_number ?? 1);
    setIsOrdering(true);
    if (menuItems.length === 0) {
      try {
        const [menuData, categoriesData] = await Promise.all([
          api.getMenu(),
          api.getCategories()
        ]);
        setMenuItems(menuData);
        setCategories(['Toate', ...categoriesData]);
      } catch (error) {
        alert('Failed to load menu. Please try again.');
        setIsOrdering(false);
      }
    }
  };

  const closeOrderForm = () => {
    setIsOrdering(false);
    clearCart();
    setSelectedCategory('Toate');
  };

  const submitWaiterOrder = async () => {
    if (cart.length === 0) {
      alert('Coșul este gol!');
      return;
    }

    setOrderLoading(true);
    try {
      const orderData = {
        tableNumber: orderTableNumber,
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity
        }))
      };

      const order = await api.post<OrderWithItems>('/orders/waiter', orderData);
      clearCart();
      setIsOrdering(false);
      setSelectedCategory('Toate');
      setSuccessMessage(`Comanda #${order.id} plasată cu succes pentru Masa ${orderTableNumber}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      alert('❌ Comanda a eșuat: ' + (error.message || 'Eroare necunoscută'));
    } finally {
      setOrderLoading(false);
    }
  };

  // ── Dashboard helpers ────────────────────────────────────────────────────────

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

  const markTableAsServed = async (tableNumber: number) => {
    setLoading(true);
    try {
      await api.updateTableOrdersStatus(tableNumber, 'Served');
    } catch (error) {
      console.error('Error marking table as served:', error);
      alert('Nu s-a putut marca masa ca servită');
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

      // Reset unpaid total for this table to 0
      setTableUnpaidTotals(prev => {
        const newMap = new Map(prev);
        newMap.set(tableNumber, 0);
        console.log(`[Waiter] Reset unpaid total for table ${tableNumber} to 0`);
        return newMap;
      });

      await loadOrders();
    } catch (error) {
      console.error('Error marking table as paid:', error);
      alert('Nu s-a putut marca masa ca plătită');
    } finally {
      setLoading(false);
    }
  };


  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="waiter-container">
      <header className="waiter-header">
        <h1>Panoul Chelnerului</h1>
        <div className="header-buttons">
          {isOrdering ? (
            <button className="take-order-btn" onClick={closeOrderForm}>
              ✕ Anulează Comanda
            </button>
          ) : (
            <button
              className="take-order-btn"
              onClick={openOrderForm}
              disabled={assignedTables.length === 0}
              title={assignedTables.length === 0 ? 'No tables assigned' : undefined}
            >
              📝 Ia Comanda
            </button>
          )}
        </div>
      </header>

      {successMessage && (
        <div className="success-notification">
          <div className="success-content">
            ✅ {successMessage}
          </div>
        </div>
      )}

      {waiterCalls.length > 0 && (
        <div className="waiter-calls-container">
          {waiterCalls.map((call, index) => (
            <div key={`${call.tableNumber}-${call.timestamp}`} className="waiter-call-alert">
              <div className="alert-content">
                🔔 <strong>Table {call.tableNumber} is calling!</strong>
                <span>Customer: {call.customerName}</span>
                <button onClick={() => setWaiterCalls(prev => prev.filter((_, i) => i !== index))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Inline order form ── */}
      {isOrdering && (
        <div className="inline-order-panel">
          <div className="inline-order-body">
            <div className="inline-cart-section">
              <h2>Coș de Cumpărături</h2>
              <div className="table-selector-inline">
                <label htmlFor="order-table-select">Selectează Masa:</label>
                <select
                  id="order-table-select"
                  value={orderTableNumber}
                  onChange={(e) => setOrderTableNumber(parseInt(e.target.value))}
                >
                  {assignedTables.map(table => (
                    <option key={table.table_number} value={table.table_number}>Masa {table.table_number}</option>
                  ))}
                </select>
              </div>
              <CartDisplay
                cart={cart}
                onRemove={removeFromCart}
                onUpdateQuantity={updateQuantity}
                totalPrice={getTotalPrice()}
                onSubmit={submitWaiterOrder}
                loading={orderLoading}
                submitButtonText="Trimite Comanda"
                showSessionInfo={false}
              />
            </div>
            <div className="inline-menu-section">
              <h2>Meniu</h2>
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
      )}

      {/* ── Dashboard (hidden while ordering) ── */}
      {!isOrdering && (
        <>
          {assignedTables.filter(table => {
            const unpaidTotal = tableUnpaidTotals.get(table.table_number) || 0;
            return unpaidTotal > 0;
          }).length > 0 && (
            <div className="assigned-tables-section">
              <h3>Mesele Tale</h3>
              <div className="assigned-tables-grid">
                {assignedTables
                  .filter(table => {
                    const unpaidTotal = tableUnpaidTotals.get(table.table_number) || 0;
                    return unpaidTotal > 0;
                  })
                  .map(table => {
                    const unpaidTotal = tableUnpaidTotals.get(table.table_number) || 0;
                    return (
                      <div key={table.id} className="table-card">
                        <div className="table-info">
                          <h4>Masa {table.table_number}</h4>
                          <div className="table-stats">
                            <span className="unpaid-badge">Neplătit: {(typeof unpaidTotal === 'number' ? unpaidTotal : 0).toFixed(2)} Lei</span>
                            <button
                              className="pay-btn"
                              onClick={() => markTableAsPaid(table.table_number)}
                              disabled={loading}
                            >
                              Marchează ca Plătit
                            </button>
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

          {assignedTables.length > 0 && assignedTables.filter(table => {
            const unpaidTotal = tableUnpaidTotals.get(table.table_number) || 0;
            return unpaidTotal > 0;
          }).length === 0 && (
            <div className="no-tables-warning">
              <p>✓ Toate mesele tale sunt plătite!</p>
            </div>
          )}

          {notification && (
            <div className="notification-banner">
              {notification}
            </div>
          )}

          {(() => {
            const readyByTable = readyOrders.reduce((acc, order) => {
              if (!acc[order.tableNumber]) acc[order.tableNumber] = [];
              acc[order.tableNumber].push(order);
              return acc;
            }, {} as Record<number, typeof readyOrders>);
            const tableCount = Object.keys(readyByTable).length;
            return (
              <>
                <div className="waiter-stats">
                  <div className="stat-card ready">
                    <h3>Gata de Servit</h3>
                    <p className="stat-number">{tableCount}</p>
                  </div>
                </div>

                <section className="orders-section">
                  <h2 className="section-title">Comenzi Gata</h2>
                  {tableCount === 0 ? (
                    <div className="empty-state">
                      <p>Nu există comenzi gata de servit</p>
                    </div>
                  ) : (
                    <div className="orders-grid">
                      {Object.entries(readyByTable)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([tableNum, tableOrders]) => {
                          const mergedItems = tableOrders.reduce((acc, order) => {
                            for (const item of order.items) {
                              const existing = acc.get(item.menuItemId);
                              if (existing) {
                                existing.quantity += item.quantity;
                              } else {
                                acc.set(item.menuItemId, { ...item });
                              }
                            }
                            return acc;
                          }, new Map<number, (typeof tableOrders)[0]['items'][0]>());
                          const total = tableOrders.reduce((sum, o) => sum + (typeof o.totalPrice === 'number' ? o.totalPrice : 0), 0);
                          return (
                            <div key={tableNum} className="waiter-order-card ready-order">
                              <div className="order-header">
                                <div>
                                  <h3>Masa {tableNum}</h3>
                                </div>
                                <div className="status-badge ready">GATA</div>
                              </div>
                              <div className="order-items-list">
                                {Array.from(mergedItems.values()).map(item => (
                                  <div key={item.menuItemId} className="order-item">
                                    <span className="item-quantity">{item.quantity}x</span>
                                    <span className="item-name">{item.name}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="order-footer">
                                <p className="order-total">Total: {total.toFixed(2)} Lei</p>
                                <button
                                  className="btn-serve"
                                  onClick={() => markTableAsServed(Number(tableNum))}
                                  disabled={loading}
                                >
                                  ✓ Marchează Masa ca Servită
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
};

export default Waiter;
