const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Storage for receipts
const receiptStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'property-portal/receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
    resource_type: 'auto',
    transformation: [{ quality: 'auto:good' }],
  },
});

// Storage for documents
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'property-portal/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'webp'],
    resource_type: 'auto',
  },
});

// Storage for project photos
const photoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'property-portal/projects',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
    transformation: [{ width: 1920, crop: 'limit' }, { quality: 'auto:good' }],
  },
});

// Storage for notice attachments
const noticeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'property-portal/notices',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
    resource_type: 'auto',
  },
});

module.exports = {
  cloudinary,
  receiptStorage,
  documentStorage,
  photoStorage,
  noticeStorage,
};
