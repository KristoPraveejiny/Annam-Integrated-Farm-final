import { pool } from '../db.js';
import { 
  sendProductApprovedEmail, 
  sendProductRejectedEmail, 
  sendNewOrderEmail,
  sendOrderStatusEmail,
  sendOrderCompletedEmail,
  sendStockReductionEmail
} from '../services/emailService.js';
import {
  buildCheckout,
  verifyIpnSignature,
  retrievePayment,
  isPaidStatus,
  isPayhereConfigured,
  isSandbox,
  getCurrency,
  getMinimumAmount,
} from '../services/payhereService.js';


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

// A single product, looked up by id alone. This backs the QR flow: the code
// carries nothing but the product id, so whatever is in the database at scan
// time is what the customer sees.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getMarketplaceProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Postgres raises on a malformed uuid, which would surface as a 500 for
    // what is really just a bad link.
    if (!UUID_PATTERN.test(String(id || ''))) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Unlike the listing query this does not filter on available_quantity:
    // a sold-out product still has to render, or a printed QR label would
    // stop working the moment stock ran out.
    const result = await pool.query(
      `SELECT p.*, f.name AS farm_name, u.full_name AS farmer_name
       FROM products p
       JOIN farms f ON p.farm_id = f.id
       LEFT JOIN app_users u ON u.id = p.farmer_id
       WHERE p.id = $1 AND p.status = 'approved'`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or not available.' });
    }

    // Prices change; a scanned page must never come from a cache.
    res.set('Cache-Control', 'no-store');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in getMarketplaceProductById:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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

/**
 * PAYHERE PAYMENT FLOW
 *
 * 1. createPayhereCheckout - reserves the order (payment_status pending) and returns
 *                            the signed form the browser posts to PayHere.
 * 2. payhereNotify         - PayHere's server-to-server IPN; the authoritative
 *                            confirmation, verified with the md5sig hash.
 * 3. confirmPayhereOrder   - called when the customer returns from PayHere; falls back
 *                            to the Payment Retrieval API when the IPN has not arrived
 *                            (e.g. localhost has no public URL for PayHere to call).
 */

async function markOrderPaid(orderId, { amount, currency, method, raw }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `UPDATE payments
       SET status = 'paid', amount = $2, currency = $3, payment_method = $4,
           paid_at = NOW(), raw_payload = $5
       WHERE order_id = $1 AND status <> 'paid'
       RETURNING id`,
      [orderId, amount, currency, method || 'PayHere', JSON.stringify(raw || {})]
    );

    // Already settled by the other path (IPN vs return url) - nothing to do.
    if (paymentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(`UPDATE orders SET payment_status = 'authorized' WHERE id = $1`, [orderId]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function sendOrderPaidEmails(orderId) {
  try {
    const orderRes = await pool.query(
      `SELECT o.order_number, o.total_amount, u.email, u.full_name,
              (SELECT amount FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) AS advance
       FROM orders o JOIN app_users u ON u.id = o.customer_user_id
       WHERE o.id = $1`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order || !order.email) return;

    await Promise.allSettled([
      sendNewOrderEmail(order.email, {
        orderNumber: order.order_number,
        totalAmount: Number(order.total_amount || 0),
        status: 'pending',
        customerName: order.full_name || 'Customer',
        advanceAmount: Number(order.advance || 0),
        paymentMethod: 'PayHere',
        senderDetails: {},
      }),
      sendOrderStatusEmail(order.email, {
        orderNumber: order.order_number,
        status: 'Order confirmed and 25% advance received',
      }),
    ]);
  } catch (err) {
    console.error('Failed to send order emails:', err);
  }
}

async function notifyStockReductions(stockReductionEvents) {
  if (!stockReductionEvents.length) return;
  const customerEmailsRes = await pool.query(
    `SELECT email FROM app_users WHERE role = 'customer' AND email IS NOT NULL AND email <> ''`
  );
  const customerEmails = customerEmailsRes.rows.map((row) => row.email);
  for (const event of stockReductionEvents) {
    for (const email of customerEmails) {
      await sendStockReductionEmail(email, {
        productName: event.productName,
        remainingStock: event.remainingStock,
        reducedBy: event.reducedBy,
        unit: event.unit,
        farmName: 'Annam Integrated Farm',
      });
    }
  }
}

export const createPayhereCheckout = async (req, res) => {
  if (!isPayhereConfigured()) {
    return res.status(503).json({
      error: 'Online payment is not configured. PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET are required.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer_id = req.user.userId;
    const { cart_item_id = null } = req.body;

    const customerInfoRes = await client.query(
      'SELECT email, full_name, phone FROM app_users WHERE id = $1 LIMIT 1',
      [customer_id]
    );
    const customer = customerInfoRes.rows[0] || {};

    const cartRes = await client.query('SELECT id FROM carts WHERE customer_id = $1', [customer_id]);
    if (cartRes.rows.length === 0) throw new Error('Cart is empty');
    const cart_id = cartRes.rows[0].id;

    const itemsRes = await client.query(
      `SELECT ci.*, p.name as product_name, p.unit, p.available_quantity
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1
         AND ($2::uuid IS NULL OR ci.id = $2::uuid)`,
      [cart_id, cart_item_id]
    );
    if (itemsRes.rows.length === 0) {
      throw new Error(cart_item_id ? 'That item is no longer in your cart' : 'Cart is empty');
    }
    const items = itemsRes.rows;

    let subtotal = 0;
    for (const item of items) {
      const prodRes = await client.query('SELECT available_quantity FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
      const available = prodRes.rows[0].available_quantity;
      if (item.quantity > available) throw new Error(`Not enough stock for ${item.product_name}`);
      subtotal += Number(item.quantity) * Number(item.price);
    }

    // The marketplace collects a 25% advance up front, as before.
    const advanceAmount = Number((subtotal * 0.25).toFixed(2));
    if (advanceAmount <= 0) throw new Error('Payable amount must be greater than zero');

    // PayHere rejects anything under its floor, so stop here rather than
    // reserving stock for a payment the gateway will refuse.
    const minimumAmount = getMinimumAmount();
    if (advanceAmount < minimumAmount) {
      const minimumCartTotal = (minimumAmount * 4).toFixed(2);
      throw new Error(
        `The 25% advance (Rs. ${advanceAmount.toFixed(2)}) is below PayHere's minimum of Rs. ${minimumAmount.toFixed(2)}. `
        + `Please order at least Rs. ${minimumCartTotal} worth of items.`
      );
    }

    const orderNumber = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const orderRes = await client.query(
      `INSERT INTO orders (order_number, customer_user_id, status, payment_status, subtotal, total_amount)
       VALUES ($1, $2, 'pending', 'pending', $3, $4) RETURNING id, order_number`,
      [orderNumber, customer_id, subtotal, subtotal]
    );
    const order_id = orderRes.rows[0].id;

    const stockReductionEvents = [];
    for (const item of items) {
      const lineTotal = Number(item.quantity) * Number(item.price);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES ($1, $2, $3, $4, $5)`,
        [order_id, item.product_id, item.quantity, item.price, lineTotal]
      );
      await client.query(
        `UPDATE products SET available_quantity = available_quantity - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
      await client.query(
        `UPDATE products SET status = 'out_of_stock' WHERE id = $1 AND available_quantity <= 0 AND status != 'out_of_stock'`,
        [item.product_id]
      );
      stockReductionEvents.push({
        productId: item.product_id,
        productName: item.product_name,
        remainingStock: Math.max(0, Number(item.available_quantity) - Number(item.quantity)),
        reducedBy: Number(item.quantity),
        unit: item.unit,
      });
    }

    await client.query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND ($2::uuid IS NULL OR id = $2::uuid)',
      [cart_id, cart_item_id]
    );

    // Pending payment row; PayHere flips it to paid via the IPN or the retrieval check.
    await client.query(
      `INSERT INTO payments (order_id, provider, payment_reference, payment_method, status, amount, currency, raw_payload)
       VALUES ($1, 'PayHere', $2, 'PayHere', 'pending', $3, $4, $5)`,
      [order_id, orderNumber, advanceAmount, getCurrency(), JSON.stringify({ stage: 'checkout_created' })]
    );

    await client.query('COMMIT');

    // Stock alerts are informational and must not delay the redirect.
    notifyStockReductions(stockReductionEvents).catch((err) => console.error('Stock alert failed:', err));

    const baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
    const notifyUrl = process.env.PAYHERE_NOTIFY_URL
      || `${process.env.API_PUBLIC_URL || 'http://localhost:5000'}/api/marketplace/payhere/notify`;

    const nameParts = String(customer.full_name || 'Customer').trim().split(/\s+/);
    const checkout = buildCheckout({
      orderId: orderNumber,
      amount: advanceAmount,
      items: items.map((item) => `${item.product_name} x${item.quantity}`).join(', '),
      customer: {
        firstName: nameParts[0] || 'Customer',
        lastName: nameParts.slice(1).join(' '),
        email: customer.email || '',
        phone: customer.phone || '',
      },
      returnUrl: `${baseUrl}/marketplace/cart?payhere_order_id=${encodeURIComponent(orderNumber)}`,
      cancelUrl: `${baseUrl}/marketplace/cart?payhere_cancelled=1&payhere_order_id=${encodeURIComponent(orderNumber)}`,
      notifyUrl,
    });

    res.json({ ...checkout, orderNumber, advanceAmount, subtotal, sandbox: isSandbox() });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in createPayhereCheckout:', error);
    res.status(400).json({ error: error.message || 'Failed to start payment' });
  } finally {
    client.release();
  }
};


/**
 * Puts the reserved stock back and cancels an order whose payment never
 * completed, so an abandoned or refused checkout does not eat inventory.
 */
async function releaseUnpaidOrder(orderId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guard = await client.query(
      `SELECT o.id FROM orders o
       LEFT JOIN payments pm ON pm.order_id = o.id
       WHERE o.id = $1 AND o.status = 'pending' AND COALESCE(pm.status, 'pending') <> 'paid'
       FOR UPDATE OF o`,
      [orderId]
    );
    if (guard.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const itemsRes = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE products
         SET available_quantity = available_quantity + $1,
             status = CASE WHEN status = 'out_of_stock' THEN 'approved' ELSE status END
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // payment_status has no 'cancelled' member; an abandoned payment is 'failed'.
    await client.query(`UPDATE orders SET status = 'cancelled', payment_status = 'failed' WHERE id = $1`, [orderId]);
    await client.query(`UPDATE payments SET status = 'failed' WHERE order_id = $1 AND status <> 'paid'`, [orderId]);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to release unpaid order:', err);
    return false;
  } finally {
    client.release();
  }
}

export const cancelPayhereOrder = async (req, res) => {
  try {
    const orderNumber = req.body.orderNumber || req.body.order_id;
    if (!orderNumber) return res.status(400).json({ error: 'Order reference is required' });

    const orderRes = await pool.query(
      'SELECT id FROM orders WHERE order_number = $1 AND customer_user_id = $2 LIMIT 1',
      [orderNumber, req.user.userId]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const released = await releaseUnpaidOrder(orderRes.rows[0].id);
    res.json({ released });
  } catch (err) {
    console.error('Error cancelling PayHere order:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

/** PayHere IPN. Public endpoint - authenticity comes from the md5sig hash. */
export const payhereNotify = async (req, res) => {
  try {
    const body = req.body || {};

    if (!verifyIpnSignature(body)) {
      console.warn('PayHere IPN rejected: bad signature for order', body.order_id);
      return res.status(400).send('invalid signature');
    }

    const orderRes = await pool.query('SELECT id FROM orders WHERE order_number = $1 LIMIT 1', [body.order_id]);
    if (orderRes.rows.length === 0) {
      console.warn('PayHere IPN for unknown order', body.order_id);
      return res.status(404).send('unknown order');
    }
    const orderId = orderRes.rows[0].id;

    if (isPaidStatus(body.status_code)) {
      const changed = await markOrderPaid(orderId, {
        amount: Number(body.payhere_amount || 0),
        currency: body.payhere_currency || getCurrency(),
        method: body.method || 'PayHere',
        raw: body,
      });
      if (changed) await sendOrderPaidEmails(orderId);
    } else {
      await pool.query(
        `UPDATE payments SET status = 'failed', raw_payload = $2 WHERE order_id = $1 AND status = 'pending'`,
        [orderId, JSON.stringify(body)]
      );
      await releaseUnpaidOrder(orderId);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Error handling PayHere IPN:', err);
    res.status(500).send('error');
  }
};

/** Called by the browser after returning from PayHere. */
export const confirmPayhereOrder = async (req, res) => {
  try {
    const customer_id = req.user.userId;
    const orderNumber = req.body.orderNumber || req.body.order_id;
    if (!orderNumber) return res.status(400).json({ error: 'Order reference is required' });

    const orderRes = await pool.query(
      `SELECT o.id, o.order_number, o.payment_status, o.total_amount,
              pm.status AS payment_state, pm.amount AS paid_amount
       FROM orders o
       LEFT JOIN payments pm ON pm.order_id = o.id
       WHERE o.order_number = $1 AND o.customer_user_id = $2
       LIMIT 1`,
      [orderNumber, customer_id]
    );

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    // Already confirmed by the IPN.
    if (order.payment_state === 'paid') {
      return res.json({
        status: 'paid',
        order_id: order.id,
        order_number: order.order_number,
        amount_paid: Number(order.paid_amount || 0),
      });
    }

    // No IPN yet. The customer's browser usually gets back before PayHere's
    // server-to-server callback lands, so wait briefly for it rather than
    // telling the customer the payment is unverified.
    let payment = await retrievePayment(orderNumber);

    for (let attempt = 0; attempt < 8 && !payment; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const recheck = await pool.query(
        'SELECT status, amount FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
        [order.id]
      );
      if (recheck.rows[0]?.status === 'paid') {
        return res.json({
          status: 'paid',
          order_id: order.id,
          order_number: order.order_number,
          amount_paid: Number(recheck.rows[0].amount || 0),
        });
      }

      // Retry the API every few seconds in case the IPN never arrives.
      if (attempt % 3 === 2) payment = await retrievePayment(orderNumber);
    }

    if (payment && isPaidStatus(payment.status_code)) {
      const changed = await markOrderPaid(order.id, {
        amount: Number(payment.amount || order.paid_amount || 0),
        currency: payment.currency || getCurrency(),
        method: payment.method || 'PayHere',
        raw: payment,
      });
      if (changed) await sendOrderPaidEmails(order.id);

      return res.json({
        status: 'paid',
        order_id: order.id,
        order_number: order.order_number,
        amount_paid: Number(payment.amount || order.paid_amount || 0),
      });
    }

    res.json({
      status: payment ? 'pending' : 'unverified',
      order_id: order.id,
      order_number: order.order_number,
      amount_paid: Number(order.paid_amount || 0),
      message: payment
        ? 'Payment is still being processed by PayHere.'
        : 'Payment could not be verified yet. It will be confirmed automatically once PayHere notifies us.',
    });
  } catch (err) {
    console.error('Error confirming PayHere order:', err);
    res.status(500).json({ error: 'Failed to confirm payment' });
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
              'payment_method', p.payment_method,
              'amount', p.amount,
              'status', p.status,
              'paid_at', p.paid_at,
              'sender_name', p.sender_name,
              'sender_bank_name', p.sender_bank_name,
              'sender_account_number', p.sender_account_number,
              'sender_phone', p.sender_phone,
              'sender_note', p.sender_note
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
              'payment_method', p.payment_method,
              'amount', p.amount,
              'status', p.status,
              'paid_at', p.paid_at,
              'sender_name', p.sender_name,
              'sender_bank_name', p.sender_bank_name,
              'sender_account_number', p.sender_account_number,
              'sender_phone', p.sender_phone,
              'sender_note', p.sender_note
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

export const markOrderReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const manager_id = req.user.userId;

    const farmRes = await pool.query('SELECT farm_id FROM farm_memberships WHERE user_id = $1 LIMIT 1', [manager_id]);
    const farm_id = farmRes.rows.length > 0 ? farmRes.rows[0].farm_id : null;

    if (!farm_id) {
      return res.status(400).json({ error: 'Manager does not belong to any farm.' });
    }

    const orderCheck = await pool.query(
      'SELECT id, status, farm_id FROM orders WHERE id = $1 LIMIT 1',
      [id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (orderCheck.rows[0].farm_id && orderCheck.rows[0].farm_id !== farm_id) {
      return res.status(403).json({ error: 'This order does not belong to your farm.' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = 'completed',
           payment_status = CASE WHEN payment_status = 'authorized' THEN 'paid' ELSE payment_status END,
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    try {
      const customerRes = await pool.query(
        `SELECT email 
         FROM app_users 
         WHERE id = (SELECT customer_user_id FROM orders WHERE id = $1)`,
        [id]
      );

      if (customerRes.rows.length > 0 && customerRes.rows[0].email) {
        await sendOrderCompletedEmail(customerRes.rows[0].email, {
          orderNumber: result.rows[0].order_number,
          status: result.rows[0].status,
          completedAt: result.rows[0].delivered_at || new Date().toISOString(),
        });
      }
    } catch (emailErr) {
      console.error('Failed to send order completed email:', emailErr);
    }

    res.json({ message: 'Order marked as received and completed.', order: result.rows[0] });
  } catch (error) {
    console.error('Error in markOrderReceived:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.full_name as customer_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'provider', p.provider,
              'payment_method', p.payment_method,
              'amount', p.amount,
              'status', p.status,
              'paid_at', p.paid_at,
              'sender_name', p.sender_name,
              'sender_bank_name', p.sender_bank_name,
              'sender_account_number', p.sender_account_number,
              'sender_phone', p.sender_phone,
              'sender_note', p.sender_note
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
    console.error('Error in getAdminOrders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
