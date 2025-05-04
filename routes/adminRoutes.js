// server/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authCheck, adminCheck } = require('../middleware/auth');
const User = require('../models/User');
const Pdf = require('../models/Pdf');
const Download = require('../models/Download');
const mongoose = require('mongoose');

// Middleware to ensure only admins can access these routes
router.use(authCheck, adminCheck);

// Get all users (admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-__v')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "user" or "admin"'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: user
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get PDF download statistics (admin only)
router.get('/stats/downloads', async (req, res) => {
  try {
    // Get total downloads for each PDF
    const pdfStats = await Download.aggregate([
      {
        $group: {
          _id: '$pdf',
          totalDownloads: { $sum: 1 },
          lastDownloaded: { $max: '$downloadedAt' }
        }
      },
      {
        $lookup: {
          from: 'pdfs',
          localField: '_id',
          foreignField: '_id',
          as: 'pdfDetails'
        }
      },
      {
        $unwind: '$pdfDetails'
      },
      {
        $project: {
          _id: 1,
          title: '$pdfDetails.title',
          description: '$pdfDetails.description',
          price: '$pdfDetails.price',
          totalDownloads: 1,
          lastDownloaded: 1
        }
      },
      {
        $sort: { totalDownloads: -1 }
      }
    ]);
    
    res.json({
      success: true,
      count: pdfStats.length,
      data: pdfStats
    });
  } catch (error) {
    console.error('Error fetching download statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get monthly download statistics (admin only)
router.get('/stats/monthly-downloads', async (req, res) => {
  try {
    const monthlyStats = await Download.aggregate([
      {
        $group: {
          _id: {
            month: { $month: '$downloadedAt' },
            year: { $year: '$downloadedAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      },
      {
        $project: {
          _id: 0,
          month: '$_id.month',
          year: '$_id.year',
          count: 1,
          period: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      count: monthlyStats.length,
      data: monthlyStats
    });
  } catch (error) {
    console.error('Error fetching monthly statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get revenue statistics (admin only)
router.get('/stats/revenue', async (req, res) => {
  try {
    // Calculate total revenue from all PDFs
    const totalRevenue = await User.aggregate([
      {
        $unwind: '$pdfsPurchased'
      },
      {
        $lookup: {
          from: 'pdfs',
          localField: 'pdfsPurchased',
          foreignField: '_id',
          as: 'pdfDetails'
        }
      },
      {
        $unwind: '$pdfDetails'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pdfDetails.price' }
        }
      }
    ]);
    
    // Calculate revenue by PDF
    const revenueByPdf = await User.aggregate([
      {
        $unwind: '$pdfsPurchased'
      },
      {
        $lookup: {
          from: 'pdfs',
          localField: 'pdfsPurchased',
          foreignField: '_id',
          as: 'pdfDetails'
        }
      },
      {
        $unwind: '$pdfDetails'
      },
      {
        $group: {
          _id: '$pdfDetails._id',
          title: { $first: '$pdfDetails.title' },
          price: { $first: '$pdfDetails.price' },
          purchases: { $sum: 1 },
          revenue: { $sum: '$pdfDetails.price' }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);
    
    // Calculate monthly revenue
    const monthlyRevenue = await User.aggregate([
      {
        $unwind: '$pdfsPurchased'
      },
      {
        $lookup: {
          from: 'pdfs',
          localField: 'pdfsPurchased',
          foreignField: '_id',
          as: 'pdfDetails'
        }
      },
      {
        $unwind: '$pdfDetails'
      },
      {
        $lookup: {
          from: 'downloads',
          let: { userId: '$_id', pdfId: '$pdfDetails._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    { $eq: ['$pdf', '$$pdfId'] }
                  ]
                }
              }
            },
            {
              $sort: { downloadedAt: 1 }
            },
            {
              $limit: 1
            }
          ],
          as: 'firstDownload'
        }
      },
      {
        $unwind: '$firstDownload'
      },
      {
        $group: {
          _id: {
            month: { $month: '$firstDownload.downloadedAt' },
            year: { $year: '$firstDownload.downloadedAt' }
          },
          revenue: { $sum: '$pdfDetails.price' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      },
      {
        $project: {
          _id: 0,
          month: '$_id.month',
          year: '$_id.year',
          revenue: 1,
          period: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0,
        revenueByPdf,
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching revenue statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add new PDF (admin panel)
router.post('/pdfs', async (req, res) => {
  try {
    const { title, description, size, fileSize, path, thumbnail, price, isFree, tags } = req.body;
    
    const newPdf = new Pdf({
      title,
      description,
      size,
      fileSize,
      path,
      thumbnail,
      price: price || 0,
      isFree: isFree || false,
      tags: tags || [],
      createdBy: req.dbUser._id
    });
    
    await newPdf.save();
    
    res.status(201).json({
      success: true,
      message: 'PDF created successfully',
      data: newPdf
    });
  } catch (error) {
    console.error('Error creating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update PDF details (admin panel)
router.put('/pdfs/:id', async (req, res) => {
  try {
    const { title, description, price, isFree, tags } = req.body;
    
    const updateFields = {};
    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (price !== undefined) updateFields.price = price;
    if (isFree !== undefined) updateFields.isFree = isFree;
    if (tags) updateFields.tags = tags;
    
    const pdf = await Pdf.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );
    
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }
    
    res.json({
      success: true,
      message: 'PDF updated successfully',
      data: pdf
    });
  } catch (error) {
    console.error('Error updating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get dashboard statistics (admin panel)
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPdfs = await Pdf.countDocuments();
    const totalDownloads = await Download.countDocuments();
    
    // Calculate total revenue
    const revenue = await User.aggregate([
      {
        $unwind: '$pdfsPurchased'
      },
      {
        $lookup: {
          from: 'pdfs',
          localField: 'pdfsPurchased',
          foreignField: '_id',
          as: 'pdfDetails'
        }
      },
      {
        $unwind: '$pdfDetails'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pdfDetails.price' }
        }
      }
    ]);
    
    // Get recent downloads
    const recentDownloads = await Download.find()
      .sort({ downloadedAt: -1 })
      .limit(10)
      .populate({
        path: 'user',
        select: 'displayName email'
      })
      .populate({
        path: 'pdf',
        select: 'title price'
      });
    
    // Get top downloaded PDFs
    const topPdfs = await Pdf.find()
      .sort({ downloadCount: -1 })
      .limit(5)
      .select('title description downloadCount price');
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalPdfs,
        totalDownloads,
        totalRevenue: revenue.length > 0 ? revenue[0].totalRevenue : 0,
        recentDownloads,
        topPdfs
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;