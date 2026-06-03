import express, { Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';

const router = express.Router();

// Reseed database endpoint
router.post('/seed-db', (req: Request, res: Response) => {
  try {
    console.log('🔄 Database reseed requested');
    
    // Only allow in development/preview environments
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ 
        error: 'Database reseeding not allowed in production' 
      });
      return;
    }

    // Run the seed script
    const seedScriptPath = path.join(__dirname, '../../scripts/seed.ts');
    
    exec(`npx ts-node ${seedScriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Seeding error:', error);
        res.status(500).json({ 
          error: 'Failed to reseed database',
          details: error.message 
        });
        return;
      }
      
      if (stderr) {
        console.warn('⚠️ Seeding warnings:', stderr);
      }
      
      console.log('✅ Database reseeded successfully:', stdout);
      res.status(200).json({ 
        message: 'Database reseeded successfully',
        output: stdout 
      });
    });
    
  } catch (error: any) {
    console.error('❌ Seeding error:', error);
    res.status(500).json({ 
      error: 'Failed to reseed database',
      details: error.message 
    });
  }
});

export default router;
