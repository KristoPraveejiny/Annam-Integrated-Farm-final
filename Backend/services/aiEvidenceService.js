import fs from 'fs';
import crypto from 'crypto';
import { Jimp } from 'jimp';
import blockhash from 'blockhash-core';
import exifr from 'exifr';
import { pool } from '../db.js'; // Ensure we can query the DB for duplicates

// Helper: Hamming distance for pHash
function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
}

// 1. Image Quality Check
async function checkImageQuality(filePath) {
    try {
        const image = await Jimp.read(filePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        // Very basic brightness calculation
        let rSum = 0, gSum = 0, bSum = 0;
        let count = 0;
        image.scan(0, 0, width, height, function(x, y, idx) {
            rSum += this.bitmap.data[idx + 0];
            gSum += this.bitmap.data[idx + 1];
            bSum += this.bitmap.data[idx + 2];
            count++;
        });
        const avgBrightness = (rSum + gSum + bSum) / (3 * count);

        let resolution = 'PASS';
        if (width < 400 || height < 400) resolution = 'WARNING';

        let brightness = 'PASS';
        if (avgBrightness < 40) brightness = 'WARNING'; // Dark
        if (avgBrightness > 240) brightness = 'WARNING'; // Overexposed

        return {
            resolution,
            brightness,
            resolutionStr: `${width}x${height}`
        };
    } catch (err) {
        return { resolution: 'FAIL', brightness: 'FAIL', resolutionStr: 'Unknown' };
    }
}

// 2. Duplicate Detection
export async function computeHashes(filePath) {
    let sha256_hash = null;
    let phash = null;
    try {
        const fileBuffer = fs.readFileSync(filePath);
        
        // SHA-256 (Always succeeds if file is readable)
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        sha256_hash = hashSum.digest('hex');

        try {
            // pHash (Might fail for some image formats/types)
            const image = await Jimp.read(fileBuffer);
            image.resize(16, 16);
            const imgData = { width: image.bitmap.width, height: image.bitmap.height, data: image.bitmap.data };
            const bhash = blockhash.bmvbhash(imgData, 8);
            phash = blockhash.hashToHex(bhash);
        } catch (jimpErr) {
            console.error("Jimp hashing error:", jimpErr.message);
        }

        return { sha256_hash, phash };
    } catch (err) {
        console.error("File reading error:", err);
        return { sha256_hash: null, phash: null };
    }
}

async function checkDuplicateInDB(sha256, phash) {
    // Exact match first (Fast)
    const exactMatch = await pool.query('SELECT * FROM image_hashes WHERE sha256_hash = $1 LIMIT 1', [sha256]);
    if (exactMatch.rows.length > 0) {
        return { duplicateFound: true, similarityScore: 100, phashDist: 0 };
    }

    // pHash comparison (Slower, check all or a subset)
    const allHashes = await pool.query('SELECT phash FROM image_hashes WHERE phash IS NOT NULL ORDER BY created_at DESC LIMIT 5000');
    let maxSimilarity = 0;
    
    for (const row of allHashes.rows) {
        if (!row.phash || !phash) continue;
        const dist = hammingDistance(phash, row.phash);
        const maxDist = phash.length; // usually 16 hex chars, but could be 64 for binary
        const sim = Math.round((1 - (dist / maxDist)) * 100);
        if (sim > maxSimilarity) maxSimilarity = sim;
        
        if (maxSimilarity >= 95) break; // Break early if highly similar
    }

    if (maxSimilarity >= 95) {
         return { duplicateFound: true, similarityScore: maxSimilarity };
    }
    return { duplicateFound: false, similarityScore: maxSimilarity };
}

// 3. Freshness Validation
async function checkFreshness(filePath, taskStartTime) {
    try {
        const stats = fs.statSync(filePath);
        let dateToUse = stats.birthtime || stats.mtime; // Fallback
        
        try {
            const exifData = await exifr.parse(filePath);
            if (exifData && exifData.DateTimeOriginal) {
                dateToUse = new Date(exifData.DateTimeOriginal);
            }
        } catch (e) {
            // EXIF missing or unparseable, ignore
        }

        const now = new Date();
        const diffDays = (now - dateToUse) / (1000 * 60 * 60 * 24);

        if (taskStartTime) {
            const start = new Date(taskStartTime);
            // 5 minute grace period
            if (dateToUse.getTime() < (start.getTime() - 5 * 60 * 1000)) {
                return { status: 'FATAL_BEFORE_SHIFT', date: dateToUse, daysOld: Math.round(diffDays) };
            }
        }

        if (diffDays <= 1) return { status: 'PASS', date: dateToUse, daysOld: Math.round(diffDays) };
        if (diffDays <= 7) return { status: 'WARNING', date: dateToUse, daysOld: Math.round(diffDays) };
        return { status: 'FAIL', date: dateToUse, daysOld: Math.round(diffDays) };
    } catch (err) {
        return { status: 'FAIL', date: new Date(), daysOld: 999 };
    }
}

// 4. Vision Verification Provider
async function evaluateWithVisionProvider(images, task) {
    if (!process.env.OPENROUTER_API_KEY) {
        return { 
            cropMatch: "PASS", activityMatch: "PASS", progressionValid: "PASS", sequenceLabels: "PASS", 
            aiConfidence: 80, aiExplanation: "LLM Provider not configured. Defaulting to PASS.",
            screenshotDetected: "PASS", editedDetected: "PASS"
        };
    }
    
    try {
        // Construct the prompt for multiple images
        const contentArray = [
            {
                type: "text",
                text: `You are an AI acting as an Evidence Verification Engine for agricultural tasks.
Task Name: "${task.title}"
Task Description: "${task.description || ''}"

Evaluate the provided sequence of images (Before, During, After).
Verify the following:
1. cropMatch: Is the expected crop/livestock present in the images? (PASS/FAIL)
2. activityMatch: Does the activity shown match the assigned task? (PASS/FAIL)
3. progressionValid: Is there a clear progression of work completed across the images? (PASS/FAIL)
4. sequenceLabels: Do the images visually align with a Before, During, and After sequence? (PASS/FAIL)
5. screenshotDetected: Are any of these images screenshots of another screen? (PASS/FAIL)
6. editedDetected: Do any images appear heavily photoshopped or edited? (PASS/FAIL)
7. aiConfidence: 0-100 score of how confident you are in your assessment.
8. aiExplanation: A 3-4 sentence explanation of why you gave this assessment.

Respond ONLY in valid JSON:
{
  "cropMatch": "PASS",
  "activityMatch": "PASS",
  "progressionValid": "PASS",
  "sequenceLabels": "PASS",
  "screenshotDetected": "PASS",
  "editedDetected": "PASS",
  "aiConfidence": 95,
  "aiExplanation": "..."
}`
            }
        ];

        // Add up to 3 images to the prompt
        for (let i = 0; i < Math.min(images.length, 3); i++) {
            const fileBuffer = fs.readFileSync(images[i].path);
            const base64Image = fileBuffer.toString('base64');
            const mimeType = images[i].mimetype || 'image/jpeg';
            contentArray.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: contentArray }]
            })
        });

        const data = await response.json();
        let aiText = data.choices?.[0]?.message?.content || '{}';
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiJson = JSON.parse(aiText);

        return {
            cropMatch: aiJson.cropMatch || "PASS",
            activityMatch: aiJson.activityMatch || "PASS",
            progressionValid: aiJson.progressionValid || "PASS",
            sequenceLabels: aiJson.sequenceLabels || "PASS",
            screenshotDetected: aiJson.screenshotDetected || "PASS",
            editedDetected: aiJson.editedDetected || "PASS",
            aiConfidence: parseInt(aiJson.aiConfidence) || 80,
            aiExplanation: aiJson.aiExplanation || "Automated analysis completed."
        };
    } catch (err) {
        console.error("LLM Error:", err);
        return { 
            cropMatch: "PASS", activityMatch: "PASS", progressionValid: "PASS", sequenceLabels: "PASS", 
            aiConfidence: 50, aiExplanation: "Error communicating with AI Provider.",
            screenshotDetected: "PASS", editedDetected: "PASS"
        };
    }
}

// Orchestrator: Strict Verification Engine
export async function calculateAIEvidenceVerification(images, currentTask, isFinalSubmission = true) {
    const minImages = isFinalSubmission ? 3 : 1;
    if (!images || images.length < minImages) {
        return { verificationScore: 0, riskLevel: 'High Risk', verificationResult: 'Rejected', aiExplanation: `Insufficient images provided. Minimum ${minImages} required.`, fraudSummary: {} };
    }

    let overallDuplicateScore = 0;
    let worstFreshness = 'PASS';
    let worstQuality = 'PASS';
    let hashResults = [];
    let seenHashes = new Set();

    // Process all images individually for quality, duplicates, and freshness
    for (const img of images) {
        // 1. Quality
        const quality = await checkImageQuality(img.path);
        if (quality.brightness === 'FAIL' || quality.resolution === 'FAIL') worstQuality = 'FAIL';
        else if (quality.brightness === 'WARNING' || quality.resolution === 'WARNING' && worstQuality !== 'FAIL') worstQuality = 'WARNING';
        
        // 2. Duplicate
        const hashes = await computeHashes(img.path);
        hashResults.push({ imgPath: img.path, ...hashes });
        
        let dupCheck;
        if (hashes.sha256_hash && seenHashes.has(hashes.sha256_hash)) {
            console.log("INTRA-REQUEST DUPLICATE FOUND:", hashes.sha256_hash);
            dupCheck = { duplicateFound: true, similarityScore: 100, phashDist: 0 };
        } else {
            if (hashes.sha256_hash) seenHashes.add(hashes.sha256_hash);
            dupCheck = await checkDuplicateInDB(hashes.sha256_hash, hashes.phash);
            console.log("DB DUPLICATE CHECK FOR", hashes.sha256_hash, ":", dupCheck);
        }

        if (dupCheck && dupCheck.similarityScore > overallDuplicateScore) {
            overallDuplicateScore = dupCheck.similarityScore;
        }

        // 3. Freshness
        const fresh = await checkFreshness(img.path, currentTask?.actual_start_time || currentTask?.started_at);
        if (fresh.status === 'FATAL_BEFORE_SHIFT') worstFreshness = 'FATAL_BEFORE_SHIFT';
        else if (fresh.status === 'FAIL' && worstFreshness !== 'FATAL_BEFORE_SHIFT') worstFreshness = 'FAIL';
        else if (fresh.status === 'WARNING' && worstFreshness !== 'FAIL' && worstFreshness !== 'FATAL_BEFORE_SHIFT') worstFreshness = 'WARNING';
    }

    // 4. Vision Provider
    const aiResult = await evaluateWithVisionProvider(images, currentTask);

    // 5. Scoring Math
    let dupScoreComp = (100 - overallDuplicateScore); // 100 similarity = 0 points
    let taskScoreComp = (aiResult.cropMatch === 'PASS' && aiResult.activityMatch === 'PASS') ? 100 : (aiResult.cropMatch === 'PASS' || aiResult.activityMatch === 'PASS') ? 50 : 0;
    let progScoreComp = (aiResult.progressionValid === 'PASS' && aiResult.sequenceLabels === 'PASS') ? 100 : (aiResult.progressionValid === 'PASS' || aiResult.sequenceLabels === 'PASS') ? 50 : 0;
    let qualScoreComp = worstQuality === 'PASS' ? 100 : worstQuality === 'WARNING' ? 50 : 0;
    let freshScoreComp = (worstFreshness === 'PASS') ? 100 : (worstFreshness === 'WARNING') ? 50 : 0;
    
    let totalScore = (dupScoreComp * 0.30) + (taskScoreComp * 0.20) + (progScoreComp * 0.15) + (qualScoreComp * 0.10) + (freshScoreComp * 0.10) + (aiResult.aiConfidence * 0.15);
    totalScore = Math.round(totalScore);

    // Fatal overrides
    let fatalReason = null;
    if (overallDuplicateScore >= 95) {
        totalScore = 0;
        fatalReason = "Fatal: Exact duplicate image or video detected.";
    } else if (worstFreshness === 'FATAL_BEFORE_SHIFT') {
        totalScore = 0;
        fatalReason = "Fatal: Evidence was captured before the shift started.";
    }

    // Decision Logic
    let riskLevel = 'Low Risk';
    let verificationResult = 'Verified';

    if (totalScore >= 90) {
        riskLevel = 'Low Risk';
        verificationResult = 'Verified';
    } else if (totalScore >= 70) {
        riskLevel = 'Medium Risk';
        verificationResult = 'Verified With Warning';
    } else if (totalScore >= 40) {
        riskLevel = 'High Risk';
        verificationResult = 'Manual Review Required';
    } else {
        riskLevel = 'High Risk';
        verificationResult = 'Rejected';
    }

    return {
        verificationScore: totalScore,
        riskLevel,
        aiConfidence: aiResult.aiConfidence,
        verificationResult,
        aiExplanation: fatalReason ? fatalReason : aiResult.aiExplanation,
        fraudSummary: {
            duplicateImage: overallDuplicateScore < 50 ? 'PASS' : overallDuplicateScore < 95 ? 'WARNING' : 'FAIL',
            freshness: worstFreshness === 'FATAL_BEFORE_SHIFT' ? 'FAIL' : worstFreshness,
            cropMatch: aiResult.cropMatch,
            activityMatch: aiResult.activityMatch,
            sequenceLabels: aiResult.sequenceLabels,
            imageQuality: worstQuality,
            screenshotDetected: aiResult.screenshotDetected,
            editedDetected: aiResult.editedDetected
        },
        hashResults
    };
}
