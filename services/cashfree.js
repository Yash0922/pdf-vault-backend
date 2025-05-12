// server/services/cashfree.js
const axios = require('axios');
const crypto = require('crypto');

// Config constants
const BASE_URL = 'https://sandbox.cashfree.com/pg'; // Use this for sandbox
// const BASE_URL = 'https://api.cashfree.com/pg'; // Use this for production
const API_VERSION = '2023-08-01';

// Helper function to generate a unique order ID
function generateOrderId() {
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(uniqueId);
  const orderId = hash.digest('hex');
  return orderId.substr(0, 12);
}

const cashfreeService = {
  // Create a payment session
  createPaymentSession: async (amount, userId, userEmail, userName, pdfId) => {
    try {
      const orderId = await generateOrderId();
      
      const request = {
        "order_amount": parseFloat(amount),
        "order_currency": "INR",
        "order_id": orderId,
        "customer_details": {
          "customer_id": userId,
          "customer_phone": "7678364306", // You may want to add phone to your user model
          "customer_name": userName,
          "customer_email": userEmail
        },
        "order_meta": {
          "return_url": `${process.env.FRONTEND_URL}/payment-success?order_id={order_id}&pdf_id=${pdfId}`
        }
      };
      
      // Add logging to help debug
      console.log('Creating payment order with request:', JSON.stringify(request, null, 2));
      console.log('Using API version:', API_VERSION);
      console.log('Client ID:', process.env.CASHFREE_CLIENT_ID);
      
      try {
        // Make a direct API call to Cashfree
        const response = await axios.post(
          `${BASE_URL}/orders`, 
          request,
          {
            headers: {
              'x-client-id': process.env.CASHFREE_CLIENT_ID,
              'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
              'x-api-version': API_VERSION,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('Cashfree response:', JSON.stringify(response.data, null, 2));
        
        return {
          order_id: orderId,
          payment_session_id: response.data.payment_session_id
        };
      } catch (apiError) {
        console.error('API Error in createPaymentSession:', apiError.response?.data || apiError.message);
        throw apiError;
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw error;
    }
  },
  
  // Verify payment status
  verifyPayment: async (orderId) => {
    try {
      console.log('Verifying payment for order:', orderId);
      
      try {
        // Make a direct API call to Cashfree
        const response = await axios.get(
          `${BASE_URL}/orders/${orderId}/payments`,
          {
            headers: {
              'x-client-id': process.env.CASHFREE_CLIENT_ID,
              'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
              'x-api-version': API_VERSION
            }
          }
        );
        
        console.log('Payment fetch response:', JSON.stringify(response.data, null, 2));
        
        // Check payment status
        if (response.data && response.data.length > 0) {
          const payment = response.data[0];
          return {
            isSuccess: payment.payment_status === 'SUCCESS',
            paymentDetails: payment
          };
        }
      } catch (apiError) {
        console.error('API Error in verifyPayment:', apiError.response?.data || apiError.message);
        throw apiError;
      }
      
      console.log('No payment data found for order:', orderId);
      return { isSuccess: false };
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  },
  
  // Get order details
  getOrderDetails: async (orderId) => {
    try {
      console.log('Getting order details for:', orderId);
      
      // Make a direct API call to Cashfree
      const response = await axios.get(
        `${BASE_URL}/orders/${orderId}`,
        {
          headers: {
            'x-client-id': process.env.CASHFREE_CLIENT_ID,
            'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
            'x-api-version': API_VERSION
          }
        }
      );
      
      console.log('Order details response:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('Error getting order details:', error.response?.data || error.message);
      throw error;
    }
  }
};

module.exports = cashfreeService;