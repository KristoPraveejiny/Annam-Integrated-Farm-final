import { pool } from './db.js';
import { getLivestock } from './controllers/livestockController.js';

(async () => {
  const req = { user: { userId: 'e2524f66-51f5-4282-a18b-6c5a0e327f01' } }; // Kristo
  const res = {
    json: (data) => {
      console.log('JSON RESPONSE:', JSON.stringify(data, null, 2));
    },
    status: (code) => {
      console.log('STATUS:', code);
      return { json: (data) => console.log('JSON ERROR:', data) };
    }
  };

  await getLivestock(req, res);
  process.exit(0);
})();
