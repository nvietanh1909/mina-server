const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

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
  const extension = originalName.split('.').pop();
  return `${timestamp}-${randomString}.${extension}`;
};

const uploadFile = async (file, folder = '') => {
  try {
    const fileName = generateUniqueFileName(file.originalname);
    const key = folder ? `${folder}/${fileName}` : fileName;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);
    return `${process.env.CLOUDFLARE_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error('Error uploading file to Cloudflare:', error);
    throw new Error('Failed to upload file');
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