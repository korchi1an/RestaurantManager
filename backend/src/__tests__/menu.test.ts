import request from 'supertest';
import app from '../server';

describe('Menu API', () => {
  describe('GET /api/menu', () => {
    test('should retrieve all menu items', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should return menu items with correct structure', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      
      const item = response.body[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('price');
      expect(typeof item.price).toBe('string'); // Decimal from DB
    });

    test('should order items by category and name', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      
      // Check that items are sorted (at least check first few)
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = response.body[i];
        const next = response.body[i + 1];
        
        // Either same category and name is alphabetical, or different category
        if (current.category === next.category) {
          expect(current.name.localeCompare(next.name)).toBeLessThanOrEqual(0);
        }
      }
    });

    test('should include all expected categories', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      
      const categories = [...new Set(response.body.map((item: any) => item.category))];
      
      // At minimum, should have some categories
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toEqual(expect.arrayContaining([expect.any(String)]));
    });
  });

  describe('GET /api/menu/categories', () => {
    test('should retrieve all menu categories', async () => {
      const response = await request(app).get('/api/menu/categories');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should return categories as strings', async () => {
      const response = await request(app).get('/api/menu/categories');

      expect(response.status).toBe(200);
      
      response.body.forEach((category: any) => {
        expect(typeof category).toBe('string');
      });
    });

    test('should have unique categories', async () => {
      const response = await request(app).get('/api/menu/categories');

      expect(response.status).toBe(200);
      
      const uniqueCategories = [...new Set(response.body)];
      expect(uniqueCategories.length).toBe(response.body.length);
    });

    test('categories should match menu items', async () => {
      const menuResponse = await request(app).get('/api/menu');
      const categoriesResponse = await request(app).get('/api/menu/categories');

      const menuCategories = [...new Set(menuResponse.body.map((item: any) => item.category))];
      const categories = categoriesResponse.body;

      expect(categories.sort()).toEqual(menuCategories.sort());
    });
  });

  describe('GET /api/menu/:id', () => {
    let menuItemId: number;

    beforeAll(async () => {
      const response = await request(app).get('/api/menu');
      menuItemId = response.body[0].id;
    });

    test('should retrieve a specific menu item by id', async () => {
      const response = await request(app).get(`/api/menu/${menuItemId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(menuItemId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('price');
    });

    test('should return 404 for non-existent menu item', async () => {
      const response = await request(app).get('/api/menu/99999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for invalid menu item id', async () => {
      const response = await request(app).get('/api/menu/invalid');

      expect(response.status).toBe(404);
    });
  });

  describe('Menu Data Integrity', () => {
    test('all menu items should have valid prices', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      
      response.body.forEach((item: any) => {
        const price = parseFloat(item.price);
        expect(price).toBeGreaterThan(0);
        expect(isNaN(price)).toBe(false);
      });
    });

    test('all menu items should have non-empty names', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      
      response.body.forEach((item: any) => {
        expect(item.name).toBeTruthy();
        expect(item.name.length).toBeGreaterThan(0);
      });
    });

    test('all menu items should have valid categories', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      
      response.body.forEach((item: any) => {
        expect(item.category).toBeTruthy();
        expect(item.category.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Menu Performance', () => {
    test('should respond quickly to menu requests', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/api/menu');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle multiple concurrent menu requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/api/menu')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });
});
