
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // You need to download this from Firebase

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

// Export Firebase Admin instance
module.exports = admin;