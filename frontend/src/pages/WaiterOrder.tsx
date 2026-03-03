import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItem, OrderWithItems } from '../types';
import { api } from '../services/api';
import { useCart } from '../hooks/useCart';
import MenuDisplay from '../components/MenuDisplay';
import CartDisplay from '../components/CartDisplay';
import '../styles/Customer.css';

const WaiterOrder: React.FC = () => {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string>('');

  const { cart, addToCart, removeFromCart, updateQuantity, getTotalPrice, clearCart } = useCart();

  useEffect(() => {
    const name = localStorage.getItem('user_name');
    setUserName(name || 'Waiter');
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const [menuData, categoriesData] = await Promise.all([
        api.getMenu(),
        api.getCategories()
      ]);
      setMenuItems(menuData);
      setCategories(['All', ...categoriesData]);
    } catch (error) {
      alert('Failed to load menu. Please refresh the page.');
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        tableNumber,
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity
        }))
      };

      // Waiter orders go to /orders/waiter endpoint
      const order = await api.post<OrderWithItems>('/orders/waiter', orderData);

      // Clear cart
      clearCart();

      // Redirect back to waiter dashboard with success message
      navigate('/waiter', {
        state: {
          orderSuccess: true,
          message: `Order #${order.id} placed successfully for Table ${tableNumber}!`
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit order';
      alert('❌ Order failed: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customer-container">
      <div className="customer-content">
        <div className="cart-section">
          <h2>Coș de Cumpărături</h2>

          {/* Waiter banner */}
          <div className="welcome-message waiter-banner">
            <p>👨‍🍳 Comandă Asistată de Chelner - {userName}</p>
          </div>

          {/* Table selector - always editable for waiters */}
          <div className="table-selector">
            <label htmlFor="table-select">Selectează Masa:</label>
            <select
              id="table-select"
              value={tableNumber}
              onChange={(e) => setTableNumber(parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>Masa {num}</option>
              ))}
            </select>
          </div>

          <CartDisplay
            cart={cart}
            onRemove={removeFromCart}
            onUpdateQuantity={updateQuantity}
            totalPrice={getTotalPrice()}
            onSubmit={submitOrder}
            loading={loading}
            submitButtonText="Trimite Comanda"
            showSessionInfo={false}
          />
        </div>

        <div className="menu-section">
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
  );
};

export default WaiterOrder;
