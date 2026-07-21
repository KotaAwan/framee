async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@system.local', password: 'password' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    
    const wsRes = await fetch('http://localhost:3001/api/v1/workspace', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const wsData = await wsRes.json();
    console.log(JSON.stringify(wsData.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
