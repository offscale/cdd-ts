const http = require('http');

const run = async () => {
    try {
        await new Promise((resolve, reject) => {
            const req = http.request('http://localhost:8080/v2', (res) => {});
            req.on('error', reject);
            req.end();
        });
    } catch(e) {
        console.log("caught!", e.code);
    }
};
run();
