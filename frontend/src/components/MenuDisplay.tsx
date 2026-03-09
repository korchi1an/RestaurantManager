import React from 'react';
import { MenuItem } from '../types';

interface MenuDisplayProps {
  menuItems: MenuItem[];
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onAddToCart: (item: MenuItem) => void;
}

const MenuDisplay: React.FC<MenuDisplayProps> = ({
  menuItems,
  categories,
  selectedCategory,
  onCategoryChange,
  onAddToCart
}) => {
  const filteredItems = selectedCategory === 'Toate'
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  return (
    <>
      <div className="category-tabs">
        {categories.map(category => (
          <button
            key={category}
            className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
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
              <p className="menu-item-price">{(typeof item.price === 'number' ? item.price : 0).toFixed(2)} Lei</p>
            </div>
            <button className="add-to-cart-btn" onClick={() => onAddToCart(item)}>
              Adaugă în Coș
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default MenuDisplay;
