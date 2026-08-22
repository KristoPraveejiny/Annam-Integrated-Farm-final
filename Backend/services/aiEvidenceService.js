import fs from 'fs';
import crypto from 'crypto';
import { Jimp } from 'jimp';
import blockhash from 'blockhash-core';
import exifr from 'exifr';
import { pool } from '../db.js'; // Ensure we can query the DB for duplicates

// Video evidence goes through the same pipeline as photos, but the pixel-level
// checks (brightness, resolution, perceptual hash) only apply to still images.
// Running them on a video file throws, which previously read as a corrupt image
// and scored it as a FAIL - punishing the worker for a format we accept.
const isVideoFile = (file) => {
    const mime = String(file?.mimetype || '');
    if (mime.startsWith('video/')) return true;
    return /\.(mp4|webm|mov|m4v|avi)$/i.test(String(file?.path || file?.url || ''));
};

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

const sha256OfFile = (filePath) => {
    try {
        return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    } catch (err) {
        console.error('Hashing error:', err.message);
        return null;
    }
};

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
            // Jimp v1 takes an options object; resize(16, 16) throws, which
            // silently left every phash null and reduced duplicate detection to
            // byte-identical files only.
            image.resize({ w: 16, h: 16 });
            const imgData = { width: image.bitmap.width, height: image.bitmap.height, data: image.bitmap.data };
            // bmvbhash already returns a hex string; blockhash-core has no
            // hashToHex, and calling it threw before a phash was ever produced.
            phash = blockhash.bmvbhash(imgData, 8);
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

/**
 * The vision check could not run.
 *
 * It must never be reported as a set of PASSes: an unreachable provider is not
 * evidence that the work was done, and defaulting to PASS silently turned every
 * outage into a clean verification at a fixed 80% score.
 */
const visionUnavailable = (reason) => ({
    available: false,
    cropMatch: "UNKNOWN", activityMatch: "UNKNOWN", progressionValid: "UNKNOWN", sequenceLabels: "UNKNOWN",
    screenshotDetected: "UNKNOWN", editedDetected: "UNKNOWN",
    aiConfidence: 0,
    aiExplanation: `Image content could not be verified automatically (${reason}). Needs a manual check.`
});

async function evaluateWithVisionProvider(images, task) {
    if (!process.env.OPENROUTER_API_KEY) {
        return visionUnavailable('AI provider not configured');
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

        // Only still images can be sent to the vision model; a video would be
        // rejected as a malformed image, failing the whole verification.
        const stillImages = images.filter((img) => !isVideoFile(img));
        const videoCount = images.length - stillImages.length;

        if (stillImages.length === 0) {
            return visionUnavailable('evidence contains only video, which cannot be analysed automatically');
        }

        for (let i = 0; i < Math.min(stillImages.length, 3); i++) {
            const fileBuffer = fs.readFileSync(stillImages[i].path);
            const base64Image = fileBuffer.toString('base64');
            const mimeType = stillImages[i].mimetype || 'image/jpeg';
            contentArray.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } });
        }

        if (videoCount > 0) {
            contentArray[0].text += `

Note: the worker also submitted ${videoCount} video file(s) which are not shown here. Judge only the still images provided, and do not treat the missing footage as evidence either way.`;
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                max_tokens: 700,
                messages: [{ role: "user", content: contentArray }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Vision verification HTTP error:', response.status, errText.slice(0, 300));
            return visionUnavailable(`provider returned ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content;
        if (!rawText) {
            console.error('Vision verification returned no content:', JSON.stringify(data).slice(0, 300));
            return visionUnavailable('empty response from provider');
        }

        const aiText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        let aiJson;
        try {
            aiJson = JSON.parse(aiText);
        } catch {
            console.error('Vision verification returned non-JSON:', aiText.slice(0, 300));
            return visionUnavailable('unreadable response from provider');
        }

        // A verdict the model did not actually give is not a PASS. Anything
        // missing or unrecognised stays UNKNOWN so it shows up for review.
        const verdict = (value) => {
            const v = String(value || '').trim().toUpperCase();
            return v === 'PASS' || v === 'FAIL' ? v : 'UNKNOWN';
        };

        const confidence = Number.parseInt(aiJson.aiConfidence, 10);

        return {
            available: true,
            cropMatch: verdict(aiJson.cropMatch),
            activityMatch: verdict(aiJson.activityMatch),
            progressionValid: verdict(aiJson.progressionValid),
            sequenceLabels: verdict(aiJson.sequenceLabels),
            screenshotDetected: verdict(aiJson.screenshotDetected),
            editedDetected: verdict(aiJson.editedDetected),
            aiConfidence: Number.isFinite(confidence) ? Math.min(100, Math.max(0, confidence)) : 0,
            aiExplanation: aiJson.aiExplanation || "Automated analysis completed."
        };
    } catch (err) {
        console.error("LLM Error:", err);
        return visionUnavailable(err.message || 'provider unreachable');
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
        const isVideo = isVideoFile(img);

        // 1. Quality - still images only; a video has no single frame to judge.
        if (!isVideo) {
            const quality = await checkImageQuality(img.path);
            if (quality.brightness === 'FAIL' || quality.resolution === 'FAIL') worstQuality = 'FAIL';
            else if (quality.brightness === 'WARNING' || quality.resolution === 'WARNING' && worstQuality !== 'FAIL') worstQuality = 'WARNING';
        }
        
        // 2. Duplicate
        const hashes = isVideo
            ? { sha256_hash: sha256OfFile(img.path), phash: null }
            : await computeHashes(img.path);
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
    
    // When the vision check could not run, its 50% of the weighting is neither
    // awarded nor deducted - the remaining deterministic checks (duplicates,
    // quality, freshness) are rescaled to stand on their own, and the result is
    // forced to manual review below. Inventing a score either way would be a
    // guess presented as a measurement.
    let totalScore;
    if (aiResult.available === false) {
        const deterministic = (dupScoreComp * 0.30) + (qualScoreComp * 0.10) + (freshScoreComp * 0.10);
        totalScore = Math.round(deterministic / 0.50);
    } else {
        totalScore = Math.round(
            (dupScoreComp * 0.30) + (taskScoreComp * 0.20) + (progScoreComp * 0.15) +
            (qualScoreComp * 0.10) + (freshScoreComp * 0.10) + (aiResult.aiConfidence * 0.15)
        );
    }

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

    if (aiResult.available === false && !fatalReason) {
        // Nothing confirmed what the photos actually show, so a human decides.
        riskLevel = 'Medium Risk';
        verificationResult = 'Manual Review Required';
    } else if (totalScore >= 90) {
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
