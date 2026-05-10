import fs from 'node:fs';

export const readFile = async (path) => fs.readFileSync(path);
export const writeFile = async (path, data) => fs.writeFileSync(path, data);
export const mkdir = async (path) => fs.mkdirSync(path);
export default { readFile, writeFile, mkdir };
