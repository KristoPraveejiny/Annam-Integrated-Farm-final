import fs from 'fs';
import path from 'path';

const controllerPath = path.join(process.cwd(), 'controllers', 'taskController.js');
let code = fs.readFileSync(controllerPath, 'utf8');

// Function to calculate smart verification score
const smartScoreLogic = `
function calculateSmartVerification(images, currentHashes, prevHashes, notes, currentTask, timeDiffMins) {
  let sImage = 0;
  let sNotes = 0;
  let sProgress = 0;
  let sDuration = 0;
  let sDuplicate = 20;

  const suspiciousFlags = [];
  const imageStatus = images.map(img => ({ ...img, status: '✓' }));

  // 1. Image Check (max 20)
  if (images.length === 1) {
    suspiciousFlags.push('Only One Image');
    sImage = 10;
  } else if (images.length >= 2) {
    sImage = 20;
  }

  // 2. Notes Check (max 20)
  if (!notes || notes.trim().length < 20) {
    suspiciousFlags.push('Very Short Notes');
    sNotes = 5;
  } else if (notes.trim().length > 50) {
    sNotes = 20;
  } else {
    sNotes = 15;
  }

  // 3. Progress Updates (max 20)
  const updatesCount = parseInt(currentTask.total_updates, 10) || 0;
  if (updatesCount === 0) {
    suspiciousFlags.push('No Previous Progress Updates');
    sProgress = 10;
  } else {
    sProgress = 20;
  }

  // 4. Time Check (max 20)
  if (timeDiffMins !== null) {
    if (timeDiffMins < 5) {
      suspiciousFlags.push('Task completion time is suspiciously short (< 5 mins)');
      sDuration = 0;
    } else if (timeDiffMins > 480) { // > 8 hours gap
      suspiciousFlags.push('Large Time Gap');
      sDuration = 10;
    } else {
      sDuration = 20;
    }
  } else {
    sDuration = 20; // Default if not applicable
  }

  // 5. Duplicate Check (max 20)
  let hasDuplicate = false;
  // Check within current batch
  const seenHashes = new Set();
  currentHashes.forEach((hash, idx) => {
    if (seenHashes.has(hash) || prevHashes.includes(hash)) {
      suspiciousFlags.push('Duplicate Image Detected');
      hasDuplicate = true;
      imageStatus[idx].status = '⚠ Duplicate';
      sDuplicate = 0;
    }
    seenHashes.add(hash);
  });

  const totalScore = sImage + sNotes + sProgress + sDuration + sDuplicate;

  let riskLevel = '🔴 High Risk';
  let recommendation = 'Manual Review Highly Recommended';
  if (totalScore >= 90) {
    riskLevel = '🟢 Low Risk';
    recommendation = 'Looks Good for Approval';
  } else if (totalScore >= 75) {
    riskLevel = '🟡 Medium Risk';
    recommendation = 'Manual Review Recommended';
  }

  return {
    score: totalScore,
    details: {
      'Image Count': sImage,
      'Notes Quality': sNotes,
      'Progress Updates': sProgress,
      'Task Duration': sDuration,
      'Duplicate Check': sDuplicate
    },
    flags: suspiciousFlags,
    riskLevel,
    recommendation,
    imagesWithStatus: imageStatus,
    hasDuplicate
  };
}
`;

if (!code.includes('calculateSmartVerification')) {
  // Insert right after the top imports/utils
  code = code.replace(/(function normalizeDateInput\(value\) \{)/, smartScoreLogic + '\n$1');
}

// Update submitTaskEvidence to use Smart Verification
const oldSubmitEvidence = /export async function submitTaskEvidence\(req, res\) \{[\s\S]*?catch \(err\) \{\s*console\.error\('Error submitting evidence:', err\);\s*res\.status\(500\)\.json\(\{ error: 'Failed to submit evidence' \}\);\s*\}\s*\}/;

const newSubmitEvidence = `export async function submitTaskEvidence(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { notes, activityType, deviceInfo, networkStatus } = req.body;
    
    // Process images & Hashes
    const images = [];
    const currentHashes = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileBuffer = fs.readFileSync(file.path);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');
        
        images.push({
          url: \`/uploads/activities/\${file.filename}\`,
          fileName: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString()
        });
        currentHashes.push(hex);
      }
    }

    if (!notes && images.length === 0) {
        return res.status(400).json({ error: 'Evidence (notes or image) is required' });
    }

    const taskLookup = await pool.query('SELECT started_at, total_updates, title, created_by_user_id FROM tasks WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = \\'In Progress\\'', [taskId, farmId, userId]);
    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not In Progress' });
    }
    const currentTask = taskLookup.rows[0];

    const prevUpdates = await pool.query('SELECT image_hashes FROM task_updates WHERE task_id = $1', [taskId]);
    let prevHashes = [];
    prevUpdates.rows.forEach(row => {
      if (Array.isArray(row.image_hashes)) prevHashes.push(...row.image_hashes);
    });

    let durationMins = null;
    if (currentTask.started_at) {
      durationMins = (new Date() - new Date(currentTask.started_at)) / 1000 / 60;
    }

    const verification = calculateSmartVerification(images, currentHashes, prevHashes, notes, currentTask, durationMins);

    // If duplicate found and user didn't explicitly override (we can use a flag from frontend like forceSubmit=true later, but for now we warn in response)
    if (verification.hasDuplicate && req.body.forceSubmit !== 'true') {
        return res.status(400).json({ 
            error: 'Duplicate images detected', 
            duplicateWarning: true,
            message: 'Duplicate Image Detected. Please remove duplicate images before submitting, or confirm to proceed anyway.',
            images: verification.imagesWithStatus
        });
    }

    const needsManagerReview = verification.flags.length > 0;

    const result = await pool.query(\`
      UPDATE tasks
      SET status = 'Waiting Manager Approval', 
          completed_at = NOW(), 
          end_time = NOW(),
          working_hours = EXTRACT(EPOCH FROM (NOW() - started_at))/3600,
          completion_percentage = 100,
          total_updates = total_updates + 1,
          updated_at = NOW(),
          verification_score = $4,
          suspicious_flags = $5::jsonb,
          needs_manager_review = $6
      WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = 'In Progress'
      RETURNING *
    \`, [taskId, farmId, userId, verification.score, JSON.stringify(verification.flags), needsManagerReview]);

    const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
    const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;

    await pool.query(
      \`INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number, image_hashes, verification_score_details, risk_level, status) 
       VALUES ($1, $2, $3, $4, 100, $5, $6, true, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11, 'Waiting for Review')\`,
      [taskId, userId, notes || null, activityType || 'Final Submission', deviceInfo, networkStatus, JSON.stringify(verification.imagesWithStatus), updateNumber, JSON.stringify(currentHashes), JSON.stringify(verification.details), verification.riskLevel]
    );

    const task = result.rows[0] || currentTask;
    const managerId = task.created_by_user_id;

    await pool.query(\`
      INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    \`, [
      managerId, farmId, 'TASK_EVIDENCE_SUBMITTED', 'Task Ready for Review',
      \`Final submission for task: \${task.title}. Waiting for your approval.\`, 'high', 'Dashboard'
    ]);

    res.json({ message: 'Task submitted successfully', task, verification });
  } catch (err) {
    console.error('Error submitting evidence:', err);
    res.status(500).json({ error: 'Failed to submit evidence' });
  }
}`;

code = code.replace(oldSubmitEvidence, newSubmitEvidence);


// Add reviewTaskUpdate
const reviewTaskUpdateCode = `
export async function reviewTaskUpdate(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const updateId = req.params.updateId;
    const { action, reason, priority, remainingPercentage } = req.body; 

    if (!['Approve', 'Request Rework', 'Reject Update'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (['Request Rework', 'Reject Update'].includes(action) && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A reason is required for this action' });
    }

    const updateLookup = await pool.query(\`
      SELECT tu.*, t.id as task_id, t.title as task_title, t.task_wage, t.assigned_to_user_id
      FROM task_updates tu
      JOIN tasks t ON tu.task_id = t.id
      WHERE tu.id = $1 AND t.farm_id = $2 LIMIT 1
    \`, [updateId, farmId]);

    if (updateLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Update not found or unauthorized' });
    }

    const update = updateLookup.rows[0];
    let newStatus = 'Approved';
    if (action === 'Request Rework') newStatus = 'Rework Required';
    if (action === 'Reject Update') newStatus = 'Rejected';

    await pool.query(\`
      UPDATE task_updates
      SET status = $1, manager_comment = $2, updated_at = NOW()
      WHERE id = $3
    \`, [newStatus, reason || null, updateId]);

    if (newStatus === 'Approved') {
      const prog = parseInt(update.progress_percentage || 0, 10);
      const earnedAmount = (Number(update.task_wage || 0) * prog) / 100;
      
      await pool.query(\`
        UPDATE task_updates SET approved_progress = $1 WHERE id = $2
      \`, [prog, updateId]);

      await pool.query(\`
        UPDATE tasks 
        SET approved_progress = approved_progress + $1,
            earned_salary = earned_salary + $2,
            completion_percentage = GREATEST(completion_percentage, $1)
        WHERE id = $3
      \`, [prog, earnedAmount, update.task_id]);

      // Create Ledger Entry
      await pool.query(\`
        INSERT INTO salary_ledger (farm_id, worker_id, task_id, task_update_id, approved_progress, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
      \`, [farmId, update.assigned_to_user_id, update.task_id, updateId, prog, earnedAmount]);
      
      // We don't call upsertMonthlyPayrollAfterApproval directly here because dynamic payroll runs off salary_ledger
      // But we can trigger a worker notification
    }

    if (newStatus === 'Rework Required') {
      // Create a rework child update row if needed, or UI handles it by referencing the parent update
    }

    res.json({ message: \`Update \${newStatus} successfully\` });
  } catch (err) {
    console.error('Error reviewing task update:', err);
    res.status(500).json({ error: 'Failed to review task update' });
  }
}
`;

if (!code.includes('export async function reviewTaskUpdate')) {
  code += '\n' + reviewTaskUpdateCode;
}

// Fix addActivityUpdate to handle duplicate warnings and smart verification
const oldAddActivityUpdate = /export async function addActivityUpdate\(req, res\) \{[\s\S]*?catch \(err\) \{\s*console\.error\('Error adding activity update:', err\);\s*res\.status\(500\)\.json\(\{ error: 'Failed to add activity update' \}\);\s*\}\s*\}/;

const newAddActivityUpdate = `export async function addActivityUpdate(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { notes, activityType, progressPercentage, deviceInfo, networkStatus } = req.body;
    
    if (!notes || notes.length < 20) {
      return res.status(400).json({ error: 'Description must be at least 20 characters.' });
    }
    
    const images = [];
    const currentHashes = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileBuffer = fs.readFileSync(file.path);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');
        
        images.push({
          url: \`/uploads/activities/\${file.filename}\`,
          fileName: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString()
        });
        currentHashes.push(hex);
      }
    }
    
    if (images.length < 1 || images.length > 5) {
      return res.status(400).json({ error: 'Please upload between 1 and 5 images.' });
    }
    
    const taskLookup = await pool.query('SELECT started_at, total_updates, title, created_by_user_id FROM tasks WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3', [taskId, farmId, userId]);
    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    const currentTask = taskLookup.rows[0];

    const lastUpdateRes = await pool.query(
      'SELECT created_at, notes, image_hashes FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC',
      [taskId]
    );
    
    let timeDiffMins = null;
    let prevHashes = [];
    if (lastUpdateRes.rows.length > 0) {
      const lastUpdate = lastUpdateRes.rows[0];
      timeDiffMins = (new Date() - new Date(lastUpdate.created_at)) / 1000 / 60;
      
      if (timeDiffMins < 10) {
        return res.status(400).json({ error: 'You recently submitted an update. Please wait at least 10 minutes before submitting another.' });
      }
      
      lastUpdateRes.rows.forEach(row => {
        if (Array.isArray(row.image_hashes)) prevHashes.push(...row.image_hashes);
      });
    } else if (currentTask.started_at) {
      timeDiffMins = (new Date() - new Date(currentTask.started_at)) / 1000 / 60;
    }

    const verification = calculateSmartVerification(images, currentHashes, prevHashes, notes, currentTask, timeDiffMins);

    if (verification.hasDuplicate && req.body.forceSubmit !== 'true') {
        return res.status(400).json({ 
            error: 'Duplicate images detected', 
            duplicateWarning: true,
            message: 'Duplicate Image Detected. Please remove duplicate images before submitting, or confirm to proceed anyway.',
            images: verification.imagesWithStatus
        });
    }
    
    const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
    const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;
    
    const insertRes = await pool.query(
      \`INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number, image_hashes, verification_score_details, risk_level, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8::jsonb, $9, $10::jsonb, $11::jsonb, $12, 'Waiting for Review') RETURNING *\`,
      [taskId, userId, notes, activityType, parseInt(progressPercentage, 10) || 0, deviceInfo, networkStatus, JSON.stringify(verification.imagesWithStatus), updateNumber, JSON.stringify(currentHashes), JSON.stringify(verification.details), verification.riskLevel]
    );
    
    await pool.query(
      'UPDATE tasks SET completion_percentage = GREATEST(completion_percentage, $1), total_updates = total_updates + 1, updated_at = NOW() WHERE id = $2 AND farm_id = $3',
      [parseInt(progressPercentage, 10) || 0, taskId, farmId]
    );
    
    if (currentTask.created_by_user_id) {
       await pool.query(\`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'normal', 'Dashboard')
       \`, [currentTask.created_by_user_id, farmId, 'ACTIVITY_UPDATE', 'New Activity Update', \`New update (\${progressPercentage}%) for task: \${currentTask.title}\`]);
       
       if (req.io) {
          req.io.to(currentTask.created_by_user_id).emit('notification', {
            title: 'New Activity Update',
            message: \`New update (\${progressPercentage}%) for task: \${currentTask.title}\`,
            category: 'ACTIVITY_UPDATE',
            priority: 'normal'
          });
       }
    }
    
    res.status(201).json({ message: 'Activity update submitted successfully', update: insertRes.rows[0], verification });
  } catch (err) {
    console.error('Error adding activity update:', err);
    res.status(500).json({ error: 'Failed to add activity update' });
  }
}`;

code = code.replace(oldAddActivityUpdate, newAddActivityUpdate);

// Also need to add reviewTaskUpdate to exports and modify getRecentTaskUpdates to fetch new fields
const oldGetRecent = "SELECT tu.id, tu.notes, tu.images, tu.image_url, tu.activity_type, tu.progress_percentage, tu.is_final, tu.created_at, tu.update_number,";
const newGetRecent = "SELECT tu.id, tu.notes, tu.images, tu.image_url, tu.activity_type, tu.progress_percentage, tu.is_final, tu.created_at, tu.update_number, tu.status as update_status, tu.manager_comment, tu.verification_score_details, tu.risk_level,";
code = code.replace(oldGetRecent, newGetRecent);

fs.writeFileSync(controllerPath, code);
console.log('taskController updated successfully');
