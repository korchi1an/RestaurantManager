import { useState, useEffect } from 'react';
import { CartItem, MenuItem } from '../types';

const CART_STORAGE_KEY = 'pendingCart';

const loadCartFromStorage = (): CartItem[] => {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
};

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>(loadCartFromStorage);

  useEffect(() => {
    try { sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch {}
  }, [cart]);

  const addToCart = (menuItem: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === menuItem.id);
      if (existing) return prev.map(i => i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  const removeFromCart = (menuItemId: number) => setCart(prev => prev.filter(i => i.menuItem.id !== menuItemId));

  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) { removeFromCart(menuItemId); return; }
    setCart(prev => prev.map(i => i.menuItem.id === menuItemId ? { ...i, quantity } : i));
  };

  const getTotalPrice = () =>
    cart.reduce((total, item) => {
      const price = typeof item.menuItem.price === 'number' ? item.menuItem.price : 0;
      return total + price * item.quantity;
    }, 0);

  const clearCart = () => {
    setCart([]);
    sessionStorage.removeItem(CART_STORAGE_KEY);
  };

  return { cart, addToCart, removeFromCart, updateQuantity, getTotalPrice, clearCart };
};
