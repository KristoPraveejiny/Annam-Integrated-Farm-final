import crypto from 'crypto';

/**
 * PayHere gateway integration.
 *
 * Two different credential pairs are involved:
 *  - Merchant ID + Merchant Secret : used to build/verify the checkout hash.
 *  - App ID + App Secret           : used for the OAuth-protected Payment
 *                                    Retrieval API (verifying a payment
 *                                    server-side without waiting for the IPN).
 */

const SANDBOX_BASE = 'https://sandbox.payhere.lk';
const LIVE_BASE = 'https://www.payhere.lk';

export function isSandbox() {
  return String(process.env.PAYHERE_MODE || 'sandbox').toLowerCase() !== 'live';
}

export function getBaseUrl() {
  return isSandbox() ? SANDBOX_BASE : LIVE_BASE;
}

export function getCheckoutUrl() {
  return `${getBaseUrl()}/pay/checkout`;
}

export function getCurrency() {
  return (process.env.PAYHERE_CURRENCY || 'LKR').toUpperCase();
}

/** PayHere refuses any payment below this amount. */
export function getMinimumAmount() {
  return Number(process.env.PAYHERE_MIN_AMOUNT || 30);
}

export function isPayhereConfigured() {
  return Boolean(process.env.PAYHERE_MERCHANT_ID && process.env.PAYHERE_MERCHANT_SECRET);
}

const md5 = (value) => crypto.createHash('md5').update(String(value)).digest('hex').toUpperCase();

/** PayHere expects amounts as a plain 2-decimal string, no thousands separators. */
export function formatAmount(amount) {
  return Number(amount || 0).toFixed(2);
}

/**
 * hash = MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret))
 */
export function buildCheckoutHash({ orderId, amount, currency }) {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  return md5(`${merchantId}${orderId}${formatAmount(amount)}${currency}${md5(merchantSecret)}`);
}

/**
 * Builds the form the browser posts to PayHere's hosted checkout page.
 */
export function buildCheckout({ orderId, amount, currency = getCurrency(), items, customer, returnUrl, cancelUrl, notifyUrl }) {
  const fields = {
    merchant_id: process.env.PAYHERE_MERCHANT_ID,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    order_id: orderId,
    items: String(items || 'Order').slice(0, 100),
    currency,
    amount: formatAmount(amount),
    first_name: customer?.firstName || 'Customer',
    last_name: customer?.lastName || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || 'N/A',
    city: customer?.city || 'N/A',
    country: customer?.country || 'Sri Lanka',
    hash: buildCheckoutHash({ orderId, amount, currency }),
  };

  return { action: getCheckoutUrl(), fields };
}

/**
 * Verifies an IPN callback.
 * md5sig = MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret))
 */
export function verifyIpnSignature(body) {
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantSecret) return false;

  const expected = md5(
    `${body.merchant_id}${body.order_id}${body.payhere_amount}${body.payhere_currency}${body.status_code}${md5(merchantSecret)}`
  );
  return expected === String(body.md5sig || '').toUpperCase();
}

let cachedToken = null;

/** OAuth client-credentials token from the App ID / App Secret pair. */
export async function getAccessToken() {
  const appId = process.env.PAYHERE_APP_ID;
  const appSecret = process.env.PAYHERE_APP_SECRET;
  if (!appId || !appSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const res = await fetch(`${getBaseUrl()}/merchant/v1/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    console.error('PayHere token request failed:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 600) * 1000,
  };
  return cachedToken.token;
}

/**
 * Looks a payment up by our order id. Returns the PayHere payment record, or
 * null when it cannot be verified (no token, domain not whitelisted, no payment yet).
 */
export async function retrievePayment(orderId) {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    const res = await fetch(`${getBaseUrl()}/merchant/v1/payment/search?order_id=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== 1 || !Array.isArray(data.data) || data.data.length === 0) {
      if (data?.msg) console.warn('PayHere retrieval:', data.msg);
      return null;
    }

    return data.data[0];
  } catch (err) {
    console.error('PayHere retrieval failed:', err?.message || err);
    return null;
  }
}

/** PayHere status codes: 2 = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargedback. */
export function isPaidStatus(statusCode) {
  return Number(statusCode) === 2;
}
