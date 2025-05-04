// server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { authCheck } = require('../middleware/auth');
const User = require('../models/User');
const Pdf = require('../models/Pdf');
const Download = require('../models/Download');

// Get current user profile
router.get('/me', authCheck, async (req, res) => {
  try {
    const user = await User.findById(req.dbUser._id)
      .select('-__v')
      .populate({
        path: 'pdfsPurchased',
        select: 'title description thumbnail price'
      });
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user profile
router.put('/me', authCheck, async (req, res) => {
  try {
    const { displayName, photoURL } = req.body;
    
    // Fields that users are allowed to update
    const updateFields = {};
    
    if (displayName) updateFields.displayName = displayName;
    if (photoURL) updateFields.photoURL = photoURL;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.dbUser._id,
      { $set: updateFields },
      { new: true }
    ).select('-__v');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Purchase a PDF
router.post('/purchase/:id', authCheck, async (req, res) => {
  try {
    const pdfId = req.params.id;
    
    // Find the PDF
    const pdf = await Pdf.findById(pdfId);
    
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }
    
    // Check if the PDF is already purchased
    if (req.dbUser.pdfsPurchased.includes(pdfId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this PDF'
      });
    }
    
    // In a real application, you would process payment here
    // For this example, we'll just add the PDF to the user's purchased list
    
    // Add PDF to user's purchased list
    await User.findByIdAndUpdate(
      req.dbUser._id,
      { $push: { pdfsPurchased: pdfId } }
    );
    
    res.json({
      success: true,
      message: 'PDF purchased successfully'
    });
  } catch (error) {
    console.error('Error purchasing PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's purchase history
router.get('/purchases', authCheck, async (req, res) => {
  try {
    const purchases = await User.findById(req.dbUser._id)
      .select('pdfsPurchased')
      .populate({
        path: 'pdfsPurchased',
        select: 'title description thumbnail price createdAt'
      });
    
    res.json({
      success: true,
      count: purchases.pdfsPurchased.length,
      data: purchases.pdfsPurchased
    });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's download history
router.get('/downloads', authCheck, async (req, res) => {
  try {
    const downloads = await Download.find({ user: req.dbUser._id })
      .sort({ downloadedAt: -1 })
      .populate({
        path: 'pdf',
        select: 'title description thumbnail'
      });
    
    res.json({
      success: true,
      count: downloads.length,
      data: downloads
    });
  } catch (error) {
    console.error('Error fetching download history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;