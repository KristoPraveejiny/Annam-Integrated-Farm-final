import { pool } from '../db.js';
import { 
  sendProductApprovedEmail, 
  sendProductRejectedEmail, 
  sendNewOrderEmail 
} from '../services/emailService.js';

// ==========================================
// FARMER FUNCTIONS
// ==========================================

export const addProduct = async (req, res) => {
  try {
    const { product_name, category, quantity, unit, harvest_date, description, quality_grade } = req.body;
    const farmer_id = req.user.userId;
    let image_url = req.body.image_url || '';
    
    if (req.file) {
      image_url = `/uploads/products/${req.file.filename}`;
    }

    // Get farmer's farm_id
    const farmRes = await pool.query('SELECT farm_id FROM farm_memberships WHERE user_id = $1 LIMIT 1', [farmer_id]);
    if (farmRes.rows.length === 0) {
      return res.status(400).json({ error: 'Farmer does not belong to any farm.' });
    }
    const farm_id = farmRes.rows[0].farm_id;
    const product_code = 'PRD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const result = await pool.query(
      `INSERT INTO products 
       (farm_id, farmer_id, product_code, name, category, description, image_url, available_quantity, unit, harvest_date, quality_grade, price, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 'pending') RETURNING *`,
      [farm_id, farmer_id, product_code, product_name, category, description, image_url, quantity, unit, harvest_date, quality_grade]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error in addProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFarmerProducts = async (req, res) => {
  try {
    const farmer_id = req.user.userId;
    const result = await pool.query(
      `SELECT p.*, pa.remarks as approval_remarks 
       FROM products p 
       LEFT JOIN product_approvals pa ON p.id = pa.product_id 
       WHERE p.farmer_id = $1 
       ORDER BY p.created_at DESC`,
      [farmer_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getFarmerProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// FARM MANAGER FUNCTIONS
// ==========================================

export const getPendingProducts = async (req, res) => {
  try {
    const manager_id = req.user.userId;
    // Get manager's farm
    const farmRes = await pool.query('SELECT farm_id FROM farm_memberships WHERE user_id = $1 LIMIT 1', [manager_id]);
    const farm_id = farmRes.rows.length > 0 ? farmRes.rows[0].farm_id : null;

    if (!farm_id) return res.status(400).json({ error: 'Manager does not belong to any farm.' });

    const result = await pool.query(
      `SELECT p.*, u.full_name as farmer_name 
       FROM products p 
       JOIN app_users u ON p.farmer_id = u.id 
       WHERE p.status = 'pending' AND p.farm_id = $1 
       ORDER BY p.created_at ASC`,
      [farm_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getPendingProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_price, remarks } = req.body;
    const manager_id = req.user.userId;

    const result = await pool.query(
      `UPDATE products SET status = 'approved', price = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [approved_price, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = result.rows[0];

    await pool.query(
      `INSERT INTO product_approvals (product_id, manager_id, status, approved_price, remarks) VALUES ($1, $2, 'approved', $3, $4)`,
      [id, manager_id, approved_price, remarks]
    );

    // Get farmer email
    const farmerRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [product.farmer_id]);
    if (farmerRes.rows.length > 0 && farmerRes.rows[0].email) {
      await sendProductApprovedEmail(farmerRes.rows[0].email, {
        productName: product.name,
        price: product.price,
        quantity: product.available_quantity,
        unit: product.unit
      });
    }

    res.json({ message: 'Product approved successfully', product });
  } catch (error) {
    console.error('Error in approveProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const manager_id = req.user.userId;

    const result = await pool.query(
      `UPDATE products SET status = 'rejected', updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = result.rows[0];

    await pool.query(
      `INSERT INTO product_approvals (product_id, manager_id, status, remarks) VALUES ($1, $2, 'rejected', $3)`,
      [id, manager_id, remarks]
    );

    // Get farmer email
    const farmerRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [product.farmer_id]);
    if (farmerRes.rows.length > 0 && farmerRes.rows[0].email) {
      await sendProductRejectedEmail(farmerRes.rows[0].email, {
        productName: product.name,
        remarks: remarks
      });
    }

    res.json({ message: 'Product rejected successfully', product });
  } catch (error) {
    console.error('Error in rejectProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// CUSTOMER FUNCTIONS
// ==========================================

export const getMarketplaceProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    
    let query = `
      SELECT p.*, f.name as farm_name 
      FROM products p 
      JOIN farms f ON p.farm_id = f.id 
      WHERE p.status = 'approved' AND p.available_quantity > 0
    `;
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (search) {
      query += ` AND p.name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getMarketplaceProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const customer_id = req.user.userId;

    // Check product availability
    const productRes = await pool.query('SELECT available_quantity, price FROM products WHERE id = $1 AND status = $2', [product_id, 'approved']);
    if (productRes.rows.length === 0) return res.status(404).json({ error: 'Product not found or unavailable.' });
    
    const product = productRes.rows[0];
    if (quantity > product.available_quantity) {
      return res.status(400).json({ error: 'Requested quantity exceeds available stock.' });
    }

    // Get or create cart
    let cartRes = await pool.query('SELECT id FROM carts WHERE customer_id = $1', [customer_id]);
    let cart_id;
    if (cartRes.rows.length === 0) {
      cartRes = await pool.query('INSERT INTO carts (customer_id) VALUES ($1) RETURNING id', [customer_id]);
    }
    cart_id = cartRes.rows[0].id;

    // Add or update cart item
    const itemRes = await pool.query('SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart_id, product_id]);
    if (itemRes.rows.length > 0) {
      const newQty = Number(itemRes.rows[0].quantity) + Number(quantity);
      if (newQty > product.available_quantity) return res.status(400).json({ error: 'Total cart quantity exceeds stock.' });
      
      await pool.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [newQty, itemRes.rows[0].id]);
    } else {
      await pool.query('INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)', 
        [cart_id, product_id, quantity, product.price]);
    }

    res.json({ message: 'Added to cart successfully' });
  } catch (error) {
    console.error('Error in addToCart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params; // cart_item_id
    const customer_id = req.user.userId;

    // Verify the cart item belongs to the user
    const checkRes = await pool.query(
      `SELECT ci.id FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE ci.id = $1 AND c.customer_id = $2`,
      [id, customer_id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found or unauthorized.' });
    }

    await pool.query('DELETE FROM cart_items WHERE id = $1', [id]);
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const viewCart = async (req, res) => {
  try {
    const customer_id = req.user.userId;
    const result = await pool.query(`
      SELECT ci.id as cart_item_id, ci.quantity, ci.price as cart_price, p.id as product_id, p.name as product_name, p.image_url, p.available_quantity, p.unit, f.name as farm_name
      FROM carts c
      JOIN cart_items ci ON c.id = ci.cart_id
      JOIN products p ON ci.product_id = p.id
      JOIN farms f ON p.farm_id = f.id
      WHERE c.customer_id = $1
    `, [customer_id]);

    let totalAmount = 0;
    result.rows.forEach(item => {
      totalAmount += (Number(item.quantity) * Number(item.cart_price));
    });

    res.json({ items: result.rows, totalAmount });
  } catch (error) {
    console.error('Error in viewCart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const placeOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer_id = req.user.userId;
    const { advanceAmount } = req.body;

    // Get cart
    const cartRes = await client.query('SELECT id FROM carts WHERE customer_id = $1', [customer_id]);
    if (cartRes.rows.length === 0) throw new Error('Cart is empty');
    const cart_id = cartRes.rows[0].id;

    // Get items
    const itemsRes = await client.query('SELECT * FROM cart_items WHERE cart_id = $1', [cart_id]);
    if (itemsRes.rows.length === 0) throw new Error('Cart is empty');
    const items = itemsRes.rows;

    let subtotal = 0;

    // Verify stock
    for (const item of items) {
      const prodRes = await client.query('SELECT available_quantity FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
      const available = prodRes.rows[0].available_quantity;
      if (item.quantity > available) throw new Error(`Not enough stock for product ID ${item.product_id}`);
      subtotal += Number(item.quantity) * Number(item.price);
    }

    const orderNumber = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Create order
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, customer_user_id, status, payment_status, subtotal, total_amount) 
       VALUES ($1, $2, 'pending', 'pending', $3, $4) RETURNING id, order_number`,
      [orderNumber, customer_id, subtotal, subtotal]
    );
    const order_id = orderRes.rows[0].id;

    // Insert order items and reduce stock
    for (const item of items) {
      const lineTotal = Number(item.quantity) * Number(item.price);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES ($1, $2, $3, $4, $5)`,
        [order_id, item.product_id, item.quantity, item.price, lineTotal]
      );
      
      // Update stock
      await client.query(
        `UPDATE products SET available_quantity = available_quantity - $1 
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
      
      // If quantity is 0, update status to out_of_stock
      await client.query(
        `UPDATE products SET status = 'out_of_stock' WHERE id = $1 AND available_quantity <= 0 AND status != 'out_of_stock'`,
        [item.product_id]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart_id]);

    // Insert advance payment record if provided
    if (advanceAmount && advanceAmount > 0) {
      await client.query(
        `INSERT INTO payments (order_id, provider, payment_reference, status, amount, currency, paid_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [order_id, 'SystemPreorder', 'ADV-' + orderNumber, 'paid', advanceAmount, 'USD']
      );
      
      // Update order payment status to authorized/partially_paid 
      // (Assuming 'pending' is default, we can set 'authorized' or keep 'pending')
      await client.query(
        `UPDATE orders SET payment_status = 'authorized' WHERE id = $1`,
        [order_id]
      );
    }

    await client.query('COMMIT');

    // Send email
    try {
      const userRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [customer_id]);
      if (userRes.rows.length > 0 && userRes.rows[0].email) {
        await sendNewOrderEmail(userRes.rows[0].email, {
          orderNumber: orderRes.rows[0].order_number,
          totalAmount: subtotal,
          status: 'pending'
        });
      }
    } catch (e) {
      console.error('Failed to send order email:', e);
    }

    res.status(201).json({ message: 'Order placed successfully', order_id, order_number: orderRes.rows[0].order_number });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in placeOrder:', error);
    res.status(400).json({ error: error.message || 'Internal server error' });
  } finally {
    client.release();
  }
};

export const getOrderHistory = async (req, res) => {
  try {
    const customer_id = req.user.userId;
    const result = await pool.query(
      `SELECT o.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'provider', p.provider,
              'amount', p.amount,
              'status', p.status,
              'paid_at', p.paid_at
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as payments
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.customer_user_id = $1 
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [customer_id]
    );

    // Fetch items for each order
    for (let order of result.rows) {
      const items = await pool.query(
        `SELECT oi.quantity, oi.unit_price, p.name as product_name, p.image_url 
         FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`, 
        [order.id]
      );
      order.items = items.rows;
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error in getOrderHistory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// SUPERADMIN FUNCTIONS
// ==========================================

export const getMarketplaceStats = async (req, res) => {
  try {
    const stats = {
      totalProducts: (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count,
      approvedProducts: (await pool.query("SELECT COUNT(*) FROM products WHERE status = 'approved'")).rows[0].count,
      pendingProducts: (await pool.query("SELECT COUNT(*) FROM products WHERE status = 'pending'")).rows[0].count,
      totalOrders: (await pool.query('SELECT COUNT(*) FROM orders')).rows[0].count,
      revenue: (await pool.query("SELECT SUM(total_amount) FROM orders WHERE payment_status = 'paid'")).rows[0].sum || 0
    };
    
    // Recent orders
    const recentOrders = await pool.query(`
      SELECT o.order_number, o.total_amount, o.status, u.full_name as customer_name, o.created_at
      FROM orders o JOIN app_users u ON o.customer_user_id = u.id
      ORDER BY o.created_at DESC LIMIT 10
    `);
    
    stats.recentOrders = recentOrders.rows;
    res.json(stats);
  } catch (error) {
    console.error('Error in getMarketplaceStats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getManagerOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.full_name as customer_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'provider', p.provider,
              'amount', p.amount,
              'status', p.status,
              'paid_at', p.paid_at
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as payments
       FROM orders o
       JOIN app_users u ON u.id = o.customer_user_id
       LEFT JOIN payments p ON p.order_id = o.id
       GROUP BY o.id, u.full_name
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getManagerOrders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
