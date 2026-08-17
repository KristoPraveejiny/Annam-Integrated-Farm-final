import { importExcelData } from './services/excelImportService.js';
import { updateAllHarvests } from './services/harvestService.js';

const run = async () => {
    try {
        console.log('Importing...');
        await importExcelData('../Vavuniya_Farm_Details_2024-2025.xlsx');
        console.log('Import done. Updating harvests...');
        await updateAllHarvests();
        console.log('Done.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
