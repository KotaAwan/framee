import axios from 'axios';

async function test() {
  try {
    const loginRes = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: 'admin@framee.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;
    
    console.log('Login success');
    
    const docRes = await axios.get('http://localhost:3001/api/v1/doc/sys_user?page=0&pageSize=10&search=', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Doc fetch success:', docRes.data.success);
  } catch (error) {
    console.error('Error Status:', error.response?.status);
    console.error('Error Body:', error.response?.data);
  }
}

test();
