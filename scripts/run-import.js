const { app } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const importer = require('./import_json_to_sqlite');
    await importer.run({
      input: path.resolve('foodie_firestore_export.json'),
      db: path.resolve('data/foodie.sqlite')
    });
    console.log('✅ Import completed successfully');
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    app.quit();
  }
});