const mongoose = require('mongoose');

const pdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    default: 'https://via.placeholder.com/100x140'
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    default: 0
  },
  isFree: {
    type: Boolean,
    default: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  tags: {
    type: [String],
    default: []
  }
});

// Add a pre-save hook to automatically set isPaid based on isFree
pdfSchema.pre('save', function(next) {
  // If price > 0, it's not free
  if (this.price > 0) {
    this.isFree = false;
    this.isPaid = true;
  }
  
  // If isFree is explicitly set to false, it's paid
  if (this.isFree === false) {
    this.isPaid = true;
  } else {
    this.isPaid = false;
  }
  
  next();
});

module.exports = mongoose.model('Pdf', pdfSchema);