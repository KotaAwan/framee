async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@framee.com', password: 'password' })
    });
    const loginData = await loginRes.json();
    console.log(loginData);
  } catch (err) {
    console.error(err.message);
  }
}
test();
