if (typeof process === "undefined" || !process.argv) {
	globalThis.process = {
		argv: [],
		env: {},
		cwd: () => "/",
		exit: (code) => {
			throw new Error(`Process exited with code ${code}`);
		},
		stdout: { write: (s) => console.log(s) },
		stderr: { write: (s) => console.error(s) },
	};
}
globalThis.setTimeout = (cb) => {
	console.log("Mocked setTimeout called!");
	cb();
	return 1;
};
globalThis.clearTimeout = () => {};
globalThis.setInterval = () => {
	return 2;
};
globalThis.clearInterval = () => {};
globalThis.setImmediate = (cb) => {
	cb();
	return 3;
};
globalThis.clearImmediate = () => {};
class MockURL {
	constructor(url, base) {
		if (base && !url.includes("://") && !url.startsWith("file:")) {
			url = new MockURL(base).href.replace(/\/[^/]*$/, "") + "/" + url;
		}
		if (!url.includes("://") && !url.startsWith("file:")) {
			throw new Error("Invalid URL");
		}
		this.href = url;
		const protoEnd = url.indexOf("://");
		if (protoEnd !== -1) {
			this.protocol = url.substring(0, protoEnd) + ":";
			const rest = url.substring(protoEnd + 3);
			const pathStart = rest.indexOf("/");
			if (pathStart !== -1) {
				this.hostname = rest.substring(0, pathStart);
				this.pathname = rest.substring(pathStart);
			} else {
				this.hostname = rest;
				this.pathname = "/";
			}
		} else {
			this.protocol = "";
			this.hostname = "";
			this.pathname = url.replace("file://", "");
		}
	}
}
globalThis.URL = MockURL;
