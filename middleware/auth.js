
const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Middleware to verify Firebase JWT token
 */
exports.authCheck = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: No token provided' 
      });
    }
    
    // Extract token
    const token = authHeader.split('Bearer ')[1];
    
    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    if (!decodedToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Invalid token' 
      });
    }
    
    // Set user data on request
    req.user = decodedToken;
    
    // Check if user exists in our database
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    // If user doesn't exist, create a new user record
    if (!user) {
      const newUser = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email.split('@')[0],
        photoURL: decodedToken.picture || '',
        role: 'admin' // Default role
      });
      
      await newUser.save();
      req.dbUser = newUser;
    } else {
      req.dbUser = user;
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Invalid token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to check if user is an admin
 */
exports.adminCheck = async (req, res, next) => {
  try {
    if (req.dbUser.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: Admin rights required' 
      });
    }
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during admin check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};