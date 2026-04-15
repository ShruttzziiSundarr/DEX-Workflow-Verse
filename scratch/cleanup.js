const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', '{');

if (fs.existsSync(target)) {
  try {
    fs.unlinkSync(target);
    console.log('Successfully deleted the corrupted file "{".');
  } catch (err) {
    console.error('Failed to delete file:', err);
  }
} else {
  console.log('File "{" not found. Checking for variations...');
}
