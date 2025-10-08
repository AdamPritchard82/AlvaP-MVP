const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

class FileStorage {
  constructor() {
    this.storageType = process.env.FILE_STORAGE || 'local';
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    
    // Ensure upload directory exists for local storage
    if (this.storageType === 'local' && !fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    
    // Initialize S3 client if using R2/S3
    if (this.storageType === 'r2' || this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'auto',
        endpoint: process.env.AWS_ENDPOINT || process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
        },
      });
      this.bucketName = process.env.AWS_BUCKET || process.env.R2_BUCKET;
    }
  }

  async saveFile(fileBuffer, fileName, mimeType = 'application/octet-stream') {
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${fileName}`;
    
    if (this.storageType === 'local') {
      const filePath = path.join(this.uploadDir, fileId);
      fs.writeFileSync(filePath, fileBuffer);
      return {
        success: true,
        fileId,
        filePath,
        url: `/uploads/${fileId}`,
        storageType: 'local'
      };
    }
    
    if (this.storageType === 'r2' || this.storageType === 's3') {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileId,
          Body: fileBuffer,
          ContentType: mimeType,
          Metadata: {
            originalName: fileName,
            uploadedAt: new Date().toISOString()
          }
        });
        
        await this.s3Client.send(command);
        
        return {
          success: true,
          fileId,
          filePath: fileId, // Key in S3
          url: `${process.env.AWS_ENDPOINT || process.env.R2_ENDPOINT}/${this.bucketName}/${fileId}`,
          storageType: this.storageType
        };
      } catch (error) {
        console.error('Error uploading to cloud storage:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }
    }
    
    throw new Error(`Unsupported storage type: ${this.storageType}`);
  }

  async getFile(fileId) {
    if (this.storageType === 'local') {
      const filePath = path.join(this.uploadDir, fileId);
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }
      return fs.readFileSync(filePath);
    }
    
    if (this.storageType === 'r2' || this.storageType === 's3') {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: fileId
        });
        
        const response = await this.s3Client.send(command);
        const chunks = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch (error) {
        console.error('Error downloading from cloud storage:', error);
        throw new Error('File not found');
      }
    }
    
    throw new Error(`Unsupported storage type: ${this.storageType}`);
  }

  async deleteFile(fileId) {
    if (this.storageType === 'local') {
      const filePath = path.join(this.uploadDir, fileId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    }
    
    if (this.storageType === 'r2' || this.storageType === 's3') {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: fileId
        });
        
        await this.s3Client.send(command);
        return { success: true };
      } catch (error) {
        console.error('Error deleting from cloud storage:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    }
    
    throw new Error(`Unsupported storage type: ${this.storageType}`);
  }

  getStorageInfo() {
    return {
      type: this.storageType,
      uploadDir: this.uploadDir,
      bucketName: this.bucketName || null,
      endpoint: process.env.AWS_ENDPOINT || process.env.R2_ENDPOINT || null
    };
  }
}

module.exports = FileStorage;
