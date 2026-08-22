import { randomUUID } from 'crypto';

export class PayoutProvider {
  async initiatePayout({ amount, recipientAccount, reference }) {
    throw new Error('initiatePayout not implemented');
  }
}

export class MockPayoutProvider extends PayoutProvider {
  async initiatePayout({ amount, sourceAccount, recipientAccount, reference }) {
    console.log(`[DEVELOPMENT / TEST MODE] Simulating transfer of Rs. ${amount} from ${sourceAccount || 'farm default account'} to ${recipientAccount} with reference: ${reference}`);

    // Simulate 1000ms network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulation rules for failures
    const shouldFail = (reference && String(reference).toLowerCase().includes('fail')) || Number(amount) === 9999;

    if (shouldFail) {
      console.log(`[DEVELOPMENT / TEST MODE] Mock payout failed as simulated.`);
      return {
        success: false,
        status: 'FAILED',
        error: 'Simulated payout failure',
        transactionId: null,
        mode: 'DEVELOPMENT / TEST MODE'
      };
    }

    const transactionId = `MOCK-TXN-${randomUUID()}`;
    console.log(`[DEVELOPMENT / TEST MODE] Mock payout successful. Txn ID: ${transactionId}`);
    return {
      success: true,
      status: 'PAID',
      transactionId,
      mode: 'DEVELOPMENT / TEST MODE'
    };
  }
}

export function getPayoutProvider() {
  // PayHere is a collection gateway and has no payout/disbursement API, so
  // salary payouts stay on the simulated provider until a payout rail is added.
  return new MockPayoutProvider();
}
