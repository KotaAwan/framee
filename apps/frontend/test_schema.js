import axios from 'axios';

async function test() {
  try {
    const loginRes = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: 'admin@framee.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;
    
    console.log('Login success');
    
    // 1. Create DocType Invoice
    const doctypeRes = await axios.post('http://localhost:3001/api/v1/doc/sys_doctype', {
      name: 'Invoice',
      label: 'Invoice',
      module_id: 'Accounting',
      is_submittable: true,
      has_lifecycle: true,
      allow_delete: true,
      allow_cancel: true,
      allow_amend: true
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const invoiceId = doctypeRes.data.data.id;
    console.log('DocType Invoice created, ID:', invoiceId);

    // 2. Create DocField Customer
    await axios.post('http://localhost:3001/api/v1/doc/sys_docfield', {
      doctype_id: invoiceId,
      fieldname: 'customer_name',
      label: 'Customer Name',
      fieldtype: 'Data',
      is_required: true,
      sort_order: 10
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('DocField customer_name created.');

    // 3. Create DocField Total Amount
    await axios.post('http://localhost:3001/api/v1/doc/sys_docfield', {
      doctype_id: invoiceId,
      fieldname: 'total_amount',
      label: 'Total Amount',
      fieldtype: 'Currency',
      is_required: true,
      sort_order: 20
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('DocField total_amount created.');
    
    console.log('Done! Please check DB for dt_invoice table.');
    
  } catch (error) {
    console.error('Error Status:', error.response?.status);
    console.error('Error Body:', error.response?.data);
  }
}

test();
