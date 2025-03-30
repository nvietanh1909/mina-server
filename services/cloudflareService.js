const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const sharp = require('sharp');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = originalName.split('.').pop().toLowerCase();
  return `${timestamp}-${randomString}.${extension}`;
};

const processImage = async (buffer, mimetype) => {
  try {
    // Nén ảnh và chuyển đổi sang định dạng webp
    const processedImage = await sharp(buffer)
      .resize(800, 800, { // Giới hạn kích thước tối đa
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 }) // Chất lượng 80%
      .toBuffer();
    
    return {
      buffer: processedImage,
      mimetype: 'image/webp'
    };
  } catch (error) {
    console.error('Lỗi xử lý ảnh:', error);
    return {
      buffer: buffer,
      mimetype: mimetype
    };
  }
};

const uploadFile = async (file, folder = '') => {
  try {
    console.log('Starting file upload...');
    console.log('File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      folder: folder
    });

    // Xử lý ảnh nếu là file ảnh
    let processedFile = file;
    if (file.mimetype.startsWith('image/')) {
      console.log('Processing image...');
      processedFile = await processImage(file.buffer, file.mimetype);
      processedFile.originalname = file.originalname;
    }

    const fileName = generateUniqueFileName(processedFile.originalname);
    const key = folder ? `${folder}/${fileName}` : fileName;
    console.log('Generated key:', key);

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
      Body: processedFile.buffer,
      ContentType: processedFile.mimetype,
    });

    console.log('Sending command to Cloudflare...');
    await s3Client.send(command);
    console.log('Upload successful');
    
    const fileUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}/${key}`;
    console.log('File URL:', fileUrl);
    return fileUrl;
  } catch (error) {
    console.error('Chi tiết lỗi upload file:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw new Error(`Lỗi upload file: ${error.message}`);
  }
};

const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return;

    // Extract key from URL
    const key = fileUrl.split(process.env.CLOUDFLARE_PUBLIC_URL + '/')[1];
    if (!key) return;

    const command = new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting file from Cloudflare:', error);
    throw new Error('Failed to delete file');
  }
};

module.exports = {
  uploadFile,
  deleteFile,
}; 