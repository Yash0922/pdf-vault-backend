const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  photoURL: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  pdfsPurchased: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pdf'
  }]
});

module.exports = mongoose.model('User', userSchema);