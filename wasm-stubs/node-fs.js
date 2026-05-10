const fsData = {};
if (typeof globalThis !== 'undefined') globalThis.__FsData = fsData;

export const existsSync = (path) => false;
export const readFileSync = (path) => {
    if (path.toString().includes('package.json')) return '{"version": "1.0.0"}';
    if (path.toString().includes('spec.json')) {
        if (typeof globalThis !== 'undefined' && globalThis.__SPEC_JSON) return globalThis.__SPEC_JSON;
    }
    return fsData[path] || '';
};
export const writeFileSync = (path, data) => {
    fsData[path] = data;
};
export const mkdirSync = (path) => {};
export const realpathSync = Object.assign((path) => path, { native: (path) => path });
export const statSync = (path) => ({ isDirectory: () => false, isFile: () => true });
export const lstatSync = (path) => ({ isDirectory: () => false, isFile: () => true });
export const readdirSync = (path) => [];
export const __getFsData = () => fsData;

export default { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync, statSync, lstatSync, readdirSync };
