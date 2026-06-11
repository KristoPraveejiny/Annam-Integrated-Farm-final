import {pool} from './db.js';
pool.query('SELECT id FROM farms WHERE owner_user_id = $1 LIMIT 1', ['e2524f66-51f5-4282-a18b-6cea0e627f07'])
  .then(res => console.log(res.rows))
  .catch(console.error);
