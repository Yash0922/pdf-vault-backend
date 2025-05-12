// server/routes/pdfRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authCheck } = require('../middleware/auth');
const Pdf = require('../models/Pdf');
const User = require('../models/User'); // Add this import for User model
const Download = require('../models/Download');
const cashfreeService = require('../services/cashfree');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/pdfs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// PDF file filter
const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all PDFs
router.get('/', authCheck, async (req, res) => {
  try {
    const pdfs = await Pdf.find()
      .select('-__v')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: pdfs.length,
      data: pdfs
    });
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get a single PDF
router.get('/:id', authCheck, async (req, res) => {
  try {
    const pdf = await Pdf.findById(req.params.id)
      .select('-__v');
    
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }
    
    res.json({
      success: true,
      data: pdf
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload a new PDF
router.post('/', authCheck, upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    const { title, description, price, isFree, tags } = req.body;
    
    // Get file size in MB
    const fileSize = req.file.size / (1024 * 1024);
    const size = fileSize.toFixed(1) + ' MB';
    
    // Create new PDF document
    const newPdf = new Pdf({
      title,
      description,
      size,
      fileSize: req.file.size,
      path: `pdfs/${req.file.filename}`,
      price: price || 0,
      isFree: isFree === 'true',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      createdBy: req.dbUser._id
    });
    
    await newPdf.save();
    
    res.status(201).json({
      success: true,
      message: 'PDF uploaded successfully',
      data: newPdf
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Download a PDF
router.get('/download/:id', authCheck, async (req, res) => {
  try {
    const pdfId = req.params.id;
    const userId = req.dbUser._id;
    
    console.log('Download requested for PDF ID:', pdfId);
    
    // Find the PDF
    const pdf = await Pdf.findById(pdfId);
    
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }
    
    console.log('PDF details:', {
      title: pdf.title, 
      path: pdf.path, 
      isFree: pdf.isFree, 
      price: pdf.price
    });
    
    // Check if the PDF is free or if the user has purchased it
    if (!pdf.isFree && !req.dbUser.pdfsPurchased.includes(pdfId)) {
      console.log('PDF requires purchase and user has not purchased it');
      return res.status(403).json({
        success: false,
        message: 'You need to purchase this PDF before downloading'
      });
    }
    
    // Record the download
    const download = new Download({
      user: userId,
      pdf: pdfId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    await download.save();
    
    // Increment download count
    pdf.downloadCount = (pdf.downloadCount || 0) + 1;
    await pdf.save();
    
    // Send the file
    const filePath = path.join(__dirname, '../uploads', pdf.path);
    console.log('Sending file from path:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found at path:', filePath);
      
      // Try alternative paths
      const fileName = path.basename(pdf.path);
      const possiblePaths = [
        filePath,
        path.join(__dirname, '../uploads/pdfs', fileName),
        path.join(__dirname, '../../uploads/pdfs', fileName),
        path.join(process.cwd(), 'uploads/pdfs', fileName),
        path.join(process.cwd(), 'uploads', pdf.path)
      ];
      
      let foundPath = null;
      for (const testPath of possiblePaths) {
        console.log('Checking alternative path:', testPath);
        if (fs.existsSync(testPath)) {
          foundPath = testPath;
          console.log('File found at alternative path:', foundPath);
          break;
        }
      }
      
      if (!foundPath) {
        console.error('File not found in any location');
        return res.status(404).json({
          success: false,
          message: 'PDF file not found on server'
        });
      }
      
      // Send the file from the found path
      return res.download(foundPath, pdf.title + '.pdf');
    }
    
    res.download(filePath, pdf.title + '.pdf');
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete a PDF
router.delete('/:id', authCheck, async (req, res) => {
  try {
    const pdf = await Pdf.findById(req.params.id);
    
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }
    
    // Check if the user is the creator of the PDF or an admin
    if (pdf.createdBy.toString() !== req.dbUser._id.toString() && req.dbUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this PDF'
      });
    }
    
    // Delete the file from storage
    const filePath = path.join(__dirname, '../uploads', pdf.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete the PDF from the database
    await Pdf.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'PDF deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create payment session for a PDF
router.get('/payment-session/:id', authCheck, async (req, res) => {
  try {
    const pdfId = req.params.id;
    
    console.log('Payment session requested for PDF ID:', pdfId);
    
    // Find the PDF
    const pdf = await Pdf.findById(pdfId);
    
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }
    
    console.log('PDF details:', {
      title: pdf.title, 
      isFree: pdf.isFree, 
      price: pdf.price
    });
    
    // Check if PDF is paid
    // FIXED: Check for isFree being false, not isPaid being true
    if (pdf.isFree) {
      return res.status(400).json({
        success: false,
        message: 'This PDF is free and does not require payment'
      });
    }
    
    // Check if the user has already purchased this PDF
    const user = await User.findById(req.dbUser._id);
    if (user.pdfsPurchased.includes(pdfId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this PDF'
      });
    }
    
    console.log('Creating payment session with amount:', pdf.price);
    
    // Create a payment session
    const paymentSession = await cashfreeService.createPaymentSession(
      pdf.price,
      req.dbUser._id.toString(),
      req.dbUser.email,
      req.dbUser.displayName || 'PDF Vault User',
      pdfId
    );
    
    console.log('Payment session created:', paymentSession);
    
    res.json({
      success: true,
      data: paymentSession
    });
  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify and complete payment
router.post('/verify-payment', authCheck, async (req, res) => {
  try {
    const { orderId, pdfId } = req.body;
    
    console.log('Verifying payment:', { orderId, pdfId });
    
    if (!orderId || !pdfId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Verify payment
    const paymentResult = await cashfreeService.verifyPayment(orderId);
    
    console.log('Payment verification result:', paymentResult);
    
    if (!paymentResult.isSuccess) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
    
    // Add PDF to user's purchased list
    await User.findByIdAndUpdate(
      req.dbUser._id,
      { $addToSet: { pdfsPurchased: pdfId } }
    );
    
    console.log('PDF added to user purchases');
    
    res.json({
      success: true,
      message: 'Payment successful and PDF added to your purchases'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Handle payment success redirect from Cashfree
router.get('/payment-success', async (req, res) => {
  const { order_id, pdf_id } = req.query;
  
  console.log('Payment success redirect with:', { order_id, pdf_id });
  
  // Redirect to frontend payment success page
  res.redirect(`${process.env.FRONTEND_URL}/payment-success?order_id=${order_id}&pdf_id=${pdf_id}`);
});

module.exports = router;