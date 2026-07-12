import jwt from 'jsonwebtoken';
import http from 'http';

const token = jwt.sign({ userId: '011aea3a-56a6-4754-b36e-863043dbc22a', role: 'farm-manager' }, 'super_secret_jwt_key_annam_farm_998877');

const req = http.request('http://localhost:5000/api/chat/sessions', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('GET Status:', res.statusCode, 'Body:', data));
});
req.on('error', err => console.error(err));
req.end();

const req2 = http.request('http://localhost:5000/api/chat/sessions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('POST Status:', res.statusCode, 'Body:', data));
});
req2.write(JSON.stringify({ title: 'Test 2' }));
req2.on('error', err => console.error(err));
req2.end();
