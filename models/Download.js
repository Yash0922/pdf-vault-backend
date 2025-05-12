const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pdf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pdf',
    required: true
  },
  downloadedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  },
  
  userAgent: {
    type: String
  }
});

// Index to efficiently retrieve download statistics
downloadSchema.index({ pdf: 1, downloadedAt: 1 });

module.exports = mongoose.model('Download', downloadSchema);