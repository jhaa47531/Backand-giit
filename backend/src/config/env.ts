import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_FILE: process.env.DATABASE_FILE || path.resolve(process.cwd(), 'data', 'giit_fee_management.sqlite'),
  JWT_SECRET: process.env.JWT_SECRET || 'giit_production_grade_jwt_secret_key_2026',
  JWT_EXPIRES_IN: '24h',
  
  // Razorpay Server-side Configuration
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_giit_default_id',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'giit_razorpay_secret_key_testing',

  // Institution Metadata
  INSTITUTION: {
    NAME: 'Global Institute of Information & Technology',
    SHORT_NAME: 'GIIT',
    PORTAL_NAME: 'GIIT Campus Portal',
    ADDRESS: 'Knowledge Park, Institutional Area, Greater Noida, UP',
    CONTACT_EMAIL: 'accounts@giit.ac.in',
    CONTACT_PHONE: '+91-120-232XXXX',
  },
};
