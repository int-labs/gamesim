import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/feedback');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

interface FeedbackData {
  pr_number: number;
  comment: string;
  mentioned_users: string[];
  feedback_type: string;
  priority: string;
  page_info: {
    url: string;
    userAgent: string;
    viewport: string;
    timestamp: string;
  };
  mentions: string;
}

// Submit feedback endpoint
router.post('/feedback', upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const feedbackData: FeedbackData = JSON.parse(req.body.feedback_data);
    const files = req.files as Express.Multer.File[];
    
    console.log('📸 New feedback received:', {
      pr: feedbackData.pr_number,
      type: feedbackData.feedback_type,
      priority: feedbackData.priority,
      images: files?.length || 0
    });

    // Store feedback in database
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    if (!db) {
      res.status(500).json({ error: 'Database not connected' });
      return;
    }

    // Create feedback document
    const feedback = {
      _id: uuidv4(),
      pr_number: feedbackData.pr_number,
      comment: feedbackData.comment,
      mentioned_users: feedbackData.mentioned_users,
      feedback_type: feedbackData.feedback_type,
      priority: feedbackData.priority,
      page_info: feedbackData.page_info,
      images: files?.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/feedback/${file.filename}`
      })) || [],
      created_at: new Date(),
      status: 'open'
    };

    // Check if thread exists for this PR
    const threadsCollection = db.collection('feedback_threads');
    let thread = await threadsCollection.findOne({ pr_number: feedbackData.pr_number });
    
    if (!thread) {
      // Create new thread
      thread = {
        _id: uuidv4(),
        pr_number: feedbackData.pr_number,
        created_at: new Date(),
        updated_at: new Date(),
        feedback_count: 0,
        status: 'open'
      };
      await threadsCollection.insertOne(thread);
    }

    // Add feedback to thread
    const feedbackCollection = db.collection('feedback');
    await feedbackCollection.insertOne(feedback);
    
    // Update thread
    await threadsCollection.updateOne(
      { _id: thread._id },
      { 
        $inc: { feedback_count: 1 },
        $set: { updated_at: new Date() }
      }
    );

    // TODO: Send Discord notification
    // TODO: Send email notifications to mentioned users

    res.status(200).json({
      message: 'Feedback submitted successfully',
      feedback_id: feedback._id,
      thread_id: thread._id
    });

  } catch (error: any) {
    console.error('❌ Feedback submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit feedback',
      details: error.message 
    });
  }
});

// Get feedback for a PR
router.get('/feedback/:prNumber', async (req: Request, res: Response) => {
  try {
    const prNumber = parseInt(req.params.prNumber);
    
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    if (!db) {
      res.status(500).json({ error: 'Database not connected' });
      return;
    }

    const feedbackCollection = db.collection('feedback');
    const feedback = await feedbackCollection
      .find({ pr_number: prNumber })
      .sort({ created_at: -1 })
      .toArray();

    res.status(200).json(feedback);

  } catch (error: any) {
    console.error('❌ Feedback retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve feedback',
      details: error.message 
    });
  }
});

export default router;
