import express from 'express';
import multer from 'multer';
import { importExcelData } from '../services/excelImportService.js';
import { updateAllHarvests } from '../services/harvestService.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const result = await importExcelData(req.file.path);
        
        // Trigger harvest calculation for newly imported crops
        await updateAllHarvests();

        res.json({ success: true, message: 'Import successful', result });
    } catch (error) {
        console.error("Import error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
