import React from 'react';
import { CartItem } from '../types';

interface CartDisplayProps {
  cart: CartItem[];
  onRemove: (menuItemId: number) => void;
  onUpdateQuantity: (menuItemId: number, quantity: number) => void;
  totalPrice: number;
  onSubmit: () => void;
  loading: boolean;
  submitButtonText?: string;
  showSessionInfo?: boolean;
}

const CartDisplay: React.FC<CartDisplayProps> = ({
  cart,
  onRemove,
  onUpdateQuantity,
  totalPrice,
  onSubmit,
  loading,
  submitButtonText = 'Trimite Comanda',
  showSessionInfo = false
}) => {
  return (
    <>
      {cart.length === 0 ? (
        <p className="empty-cart">Coșul este gol</p>
      ) : (
        <>
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.menuItem.id} className="cart-item">
                <div className="cart-item-info">
                  <h4>{item.menuItem.name}</h4>
                  <p>{(typeof item.menuItem.price === 'number' ? item.menuItem.price : 0).toFixed(2)} Lei</p>
                </div>
                <div className="cart-item-controls">
                  <button onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity + 1)}>+</button>
                  <button className="remove-btn" onClick={() => onRemove(item.menuItem.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-total">
            <h3>Total: {(totalPrice || 0).toFixed(2)} Lei</h3>
            <button 
              className="submit-order-btn" 
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? 'Se trimite...' : submitButtonText}
            </button>
            {showSessionInfo && (
              <p className="session-info">Sesiune activă - Puteți plasa comenzi multiple</p>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default CartDisplay;
