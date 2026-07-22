import { pool } from './Backend/db.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;

async function backfillVerification() {
  try {
    console.log('Starting backfill process...');
    
    // 1. Backfill task_updates image_hashes
    console.log('Fetching task updates...');
    const updatesRes = await pool.query('SELECT id, images, notes FROM task_updates');
    
    for (const update of updatesRes.rows) {
      let images = [];
      try {
        if (typeof update.images === 'string') {
          images = JSON.parse(update.images);
        } else if (Array.isArray(update.images)) {
          images = update.images;
        }
      } catch (e) {
        console.error('Error parsing images for update', update.id);
      }
      
      const hashes = [];
      for (const img of images) {
        if (img && img.url) {
          // Construct file path
          const filePath = path.join(projectRoot, 'Backend', img.url);
          try {
            if (fs.existsSync(filePath)) {
              const fileBuffer = fs.readFileSync(filePath);
              const hashSum = crypto.createHash('sha256');
              hashSum.update(fileBuffer);
              hashes.push(hashSum.digest('hex'));
            } else {
              // Create a dummy hash if file doesn't exist, just so it has something, 
              // or don't hash it. We'll skip hashing if file is missing.
              console.warn(`File missing for update ${update.id}: ${filePath}`);
            }
          } catch (e) {
            console.error(`Error hashing file for update ${update.id}: ${filePath}`);
          }
        }
      }
      
      await pool.query('UPDATE task_updates SET image_hashes = $1::jsonb WHERE id = $2', [JSON.stringify(hashes), update.id]);
    }
    
    console.log('Updated task_updates with image hashes.');
    
    // 2. Backfill tasks verification score and flags
    console.log('Fetching tasks...');
    const tasksRes = await pool.query(`
      SELECT id, started_at, completed_at, end_time, updated_at, total_updates, status
      FROM tasks 
      WHERE status IN ('Waiting Manager Approval', 'Completed', 'Approved', 'Done')
    `);
    
    for (const task of tasksRes.rows) {
      const taskUpdatesRes = await pool.query('SELECT images, image_hashes, notes FROM task_updates WHERE task_id = $1 ORDER BY created_at ASC', [task.id]);
      
      let allHashes = [];
      let totalImagesCount = 0;
      let finalNotes = '';
      
      for (let i = 0; i < taskUpdatesRes.rows.length; i++) {
        const row = taskUpdatesRes.rows[i];
        if (Array.isArray(row.image_hashes)) {
          allHashes.push(...row.image_hashes);
        }
        
        let rowImages = [];
        try {
          if (typeof row.images === 'string') {
             rowImages = JSON.parse(row.images);
          } else if (Array.isArray(row.images)) {
             rowImages = row.images;
          }
        } catch(e) {}
        
        totalImagesCount += rowImages.length;
        
        if (i === taskUpdatesRes.rows.length - 1) {
          finalNotes = row.notes || '';
        }
      }
      
      let verificationScore = 0;
      const suspiciousFlags = [];
      
      // A. Check for duplicates
      const uniqueHashes = new Set(allHashes);
      if (uniqueHashes.size < allHashes.length) {
        suspiciousFlags.push('Duplicate images detected across updates for this task.');
      }
      
      // B. Score Number of Images (Up to 30 pts)
      verificationScore += Math.min(totalImagesCount * 10, 30);
      
      // C. Notes length
      if (!finalNotes || finalNotes.trim().length < 20) {
        suspiciousFlags.push('Completion notes are very short or missing.');
      } else {
        verificationScore += 20;
      }
      
      // D. Progress updates
      const updatesCount = parseInt(task.total_updates, 10) || 0;
      if (updatesCount > 1) {
        verificationScore += 20;
      }
      
      // E. Task duration
      let durationMins = 0;
      if (task.started_at) {
        const endTime = task.completed_at || task.end_time || task.updated_at;
        if (endTime) {
          durationMins = (new Date(endTime) - new Date(task.started_at)) / 1000 / 60;
          if (durationMins < 5) {
            suspiciousFlags.push('Task completion time is suspiciously short (< 5 mins).');
          } else {
            verificationScore += 30;
          }
        }
      } else {
        suspiciousFlags.push('Task started time is missing.');
      }
      
      verificationScore = Math.min(Math.max(verificationScore, 0), 100);
      const needsManagerReview = suspiciousFlags.length > 0;
      
      await pool.query(`
        UPDATE tasks
        SET verification_score = $1, suspicious_flags = $2::jsonb, needs_manager_review = $3
        WHERE id = $4
      `, [verificationScore, JSON.stringify(suspiciousFlags), needsManagerReview, task.id]);
    }
    
    console.log('Backfill completed successfully.');
    
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    pool.end();
    process.exit(0);
  }
}

backfillVerification();
