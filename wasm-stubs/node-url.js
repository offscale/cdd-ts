export function pathToFileURL(path) {
    return new URL('file://' + path);
}
export function fileURLToPath(url) {
    if (typeof url === 'string') return new URL(url).pathname;
    return url.pathname;
}
