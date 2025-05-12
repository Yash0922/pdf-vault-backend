// server/test-cashfree.js
// Run this script with: node test-cashfree.js
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Helper function to generate a unique order ID
function generateOrderId() {
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(uniqueId);
  const orderId = hash.digest('hex');
  return orderId.substr(0, 12);
}

// Config constants
const BASE_URL = 'https://sandbox.cashfree.com/pg';
const API_VERSION = '2023-08-01';

async function testCashfreeIntegration() {
  console.log('🔍 Testing Cashfree Integration');
  console.log('============================');
  
  // Check if environment variables are set
  console.log('Checking environment variables:');
  if (!process.env.CASHFREE_CLIENT_ID) {
    console.error('❌ CASHFREE_CLIENT_ID is not set in .env file');
    return;
  }
  console.log('✅ CASHFREE_CLIENT_ID: ' + process.env.CASHFREE_CLIENT_ID);
  
  if (!process.env.CASHFREE_CLIENT_SECRET) {
    console.error('❌ CASHFREE_CLIENT_SECRET is not set in .env file');
    return;
  }
  console.log('✅ CASHFREE_CLIENT_SECRET: [Secret is set]');
  
  if (!process.env.FRONTEND_URL) {
    console.warn('⚠️ FRONTEND_URL is not set, using default: http://localhost:3000');
  } else {
    console.log('✅ FRONTEND_URL: ' + process.env.FRONTEND_URL);
  }
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // Create test order
  try {
    console.log('\n🔍 Creating a test order...');
    
    const orderId = generateOrderId();
    console.log('Generated Order ID: ' + orderId);
    
    const orderPayload = {
      "order_amount": 1.00,
      "order_currency": "INR",
      "order_id": orderId,
      "customer_details": {
        "customer_id": "test-user-123",
        "customer_phone": "9999999999",
        "customer_name": "Test User",
        "customer_email": "test@example.com"
      },
      "order_meta": {
        "return_url": `${frontendUrl}/payment-success?order_id={order_id}&pdf_id=test-123`
      }
    };
    
    console.log('Request Payload:');
    console.log(JSON.stringify(orderPayload, null, 2));
    
    const response = await axios.post(
      `${BASE_URL}/orders`,
      orderPayload,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_CLIENT_ID,
          'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
          'x-api-version': API_VERSION,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ Order created successfully!');
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Test getting order details
    console.log('\n🔍 Fetching order details...');
    
    const orderResponse = await axios.get(
      `${BASE_URL}/orders/${orderId}`,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_CLIENT_ID,
          'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
          'x-api-version': API_VERSION
        }
      }
    );
    
    console.log('\n✅ Order details fetched successfully!');
    console.log('Order Status: ' + orderResponse.data.order_status);
    
    // Test getting payments for the order
    console.log('\n🔍 Checking for payments...');
    
    const paymentsResponse = await axios.get(
      `${BASE_URL}/orders/${orderId}/payments`,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_CLIENT_ID,
          'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
          'x-api-version': API_VERSION
        }
      }
    );
    
    console.log('\n✅ Payment check completed!');
    console.log('Payment Count: ' + paymentsResponse.data.length);
    
    console.log('\n🎉 All tests passed! Your Cashfree integration is working correctly.');
    console.log('\nTo complete a test payment:');
    console.log('1. Use the payment_session_id: ' + response.data.payment_session_id);
    console.log('2. Initialize the Cashfree checkout in your frontend');
    console.log('3. Use the following test card details:');
    console.log('   - Card number: 4111 1111 1111 1111');
    console.log('   - Expiry: Any future date (e.g., 12/25)');
    console.log('   - CVV: Any 3 digits (e.g., 123)');
    console.log('   - Name: Any name');
    console.log('   - OTP: 123456');
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    
    if (error.response) {
      console.error('Error Status: ' + error.response.status);
      console.error('Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error: ' + error.message);
    }
    
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Double-check your CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET');
    console.log('2. Make sure you\'re using the correct endpoint (sandbox vs production)');
    console.log('3. Verify that your Cashfree account is active');
    console.log('4. Check if there are any network issues or firewall restrictions');
  }
}

// Run the test
testCashfreeIntegration();