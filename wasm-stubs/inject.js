if (typeof process === 'undefined' || !process.argv) {
    globalThis.process = {
        argv: [],
        env: {},
        cwd: () => '/',
        exit: (code) => { throw new Error(`Process exited with code ${code}`); },
        stdout: { write: (s) => console.log(s) },
        stderr: { write: (s) => console.error(s) }
    };
}
globalThis.setTimeout = (cb) => { console.log("Mocked setTimeout called!"); cb(); return 1; };
globalThis.clearTimeout = () => {};
globalThis.setInterval = () => { return 2; };
globalThis.clearInterval = () => {};
globalThis.setImmediate = (cb) => { cb(); return 3; };
globalThis.clearImmediate = () => {};
class MockURL {
    constructor(url, base) {
        if (!url.includes('://') && !url.startsWith('file:')) {
            throw new Error('Invalid URL');
        }
        this.href = url;
        if (base && !url.includes('://') && !url.startsWith('file:')) {
            this.href = base + '/' + url;
        }
        this.pathname = this.href.replace('file://', '');
    }
}
globalThis.URL = MockURL;

