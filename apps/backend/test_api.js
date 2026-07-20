async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@framee.com', password: 'Admin123' })
    });
    const loginData = await loginRes.json();
    console.log("Login:", loginData.success);

    const listRes = await fetch('http://localhost:3001/api/v1/meta/doctype/sys_user', {
      headers: { 'Authorization': `Bearer ${loginData.data.token}` }
    });
    const listData = await listRes.json();
    console.log("List Response:", listData.data.fields);
  } catch (err) {
    console.error("Network error:", err.message);
  }
}

test();
