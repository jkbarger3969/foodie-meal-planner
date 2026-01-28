try {
    const fs = require('fs');
    const code = fs.readFileSync('./src/main/api.js', 'utf8');
    new Function(code);
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error:", e.message);
}
