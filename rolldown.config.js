import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'dist/cli.js',
  output: {
    file: 'bin/cdd-ts.js',
    format: 'esm',
    codeSplitting: false,
  },
  transform: { target: 'es2020' },
  resolve: {
    alias: {
      'path': 'path-browserify',
      'node:path': 'path-browserify',
      'url': path.join(__dirname_local, 'wasm-stubs/node-url.js'),
      'node:url': path.join(__dirname_local, 'wasm-stubs/node-url.js'),
      'fs': path.join(__dirname_local, 'wasm-stubs/node-fs.js'),
      'node:fs': path.join(__dirname_local, 'wasm-stubs/node-fs.js'),
      'fs/promises': path.join(__dirname_local, 'wasm-stubs/node-fs-promises.js'),
      'node:fs/promises': path.join(__dirname_local, 'wasm-stubs/node-fs-promises.js'),
      'os': path.join(__dirname_local, 'wasm-stubs/node-os.js'),
      'node:os': path.join(__dirname_local, 'wasm-stubs/node-os.js'),
      'http': path.join(__dirname_local, 'wasm-stubs/node-http.js'),
      'node:http': path.join(__dirname_local, 'wasm-stubs/node-http.js'),
      'events': path.join(__dirname_local, 'wasm-stubs/node-events.js'),
      'node:events': path.join(__dirname_local, 'wasm-stubs/node-events.js'),
      'child_process': path.join(__dirname_local, 'wasm-stubs/node-child_process.js'),
      'node:child_process': path.join(__dirname_local, 'wasm-stubs/node-child_process.js'),
      'process': path.join(__dirname_local, 'wasm-stubs/node-process.js'),
      'node:process': path.join(__dirname_local, 'wasm-stubs/node-process.js')
    }
  },
  define: {
    __filename: '"/cli.js"',
    __dirname: '"/"'
  },
  moduleTypes: {
    [path.join(__dirname_local, 'wasm-stubs/inject.js')]: 'js'
  },
  banner: "if (typeof process === \"undefined\" || !process.argv) {\n\tglobalThis.process = {\n\t\targv: [],\n\t\tenv: {},\n\t\tcwd: () => \"/\",\n\t\texit: (code) => {\n\t\t\tthrow new Error(`Process exited with code ${code}`);\n\t\t},\n\t\tstdout: { write: (s) => console.log(s) },\n\t\tstderr: { write: (s) => console.error(s) },\n\t};\n}\nglobalThis.setTimeout = (cb) => {\n\tconsole.log(\"Mocked setTimeout called!\");\n\tcb();\n\treturn 1;\n};\nglobalThis.clearTimeout = () => {};\nglobalThis.setInterval = () => {\n\treturn 2;\n};\nglobalThis.clearInterval = () => {};\nglobalThis.setImmediate = (cb) => {\n\tcb();\n\treturn 3;\n};\nglobalThis.clearImmediate = () => {};\nclass MockURL {\n\tconstructor(url, base) {\n\t\tif (base && !url.includes(\"://\") && !url.startsWith(\"file:\")) {\n\t\t\turl = new MockURL(base).href.replace(/\\/[^/]*$/, \"\") + \"/\" + url;\n\t\t}\n\t\tif (!url.includes(\"://\") && !url.startsWith(\"file:\")) {\n\t\t\tthrow new Error(\"Invalid URL\");\n\t\t}\n\t\tthis.href = url;\n\t\tconst protoEnd = url.indexOf(\"://\");\n\t\tif (protoEnd !== -1) {\n\t\t\tthis.protocol = url.substring(0, protoEnd) + \":\";\n\t\t\tconst rest = url.substring(protoEnd + 3);\n\t\t\tconst pathStart = rest.indexOf(\"/\");\n\t\t\tif (pathStart !== -1) {\n\t\t\t\tthis.hostname = rest.substring(0, pathStart);\n\t\t\t\tthis.pathname = rest.substring(pathStart);\n\t\t\t} else {\n\t\t\t\tthis.hostname = rest;\n\t\t\t\tthis.pathname = \"/\";\n\t\t\t}\n\t\t} else {\n\t\t\tthis.protocol = \"\";\n\t\t\tthis.hostname = \"\";\n\t\t\tthis.pathname = url.replace(\"file://\", \"\");\n\t\t}\n\t}\n}\nglobalThis.URL = MockURL;\n",
  banner: `if (typeof process === "undefined" || !process.argv) {
	globalThis.process = {
		argv: [],
		env: {},
		cwd: () => "/",
		exit: (code) => {
			throw new Error(\`Process exited with code \${code}\`);
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
			url = new MockURL(base).href.replace(/\/[^/]*\$/, "") + "/" + url;
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
`,
  inject: {
    // Esbuild's --inject:./wasm-stubs/inject.js would execute it globally or provide shims.
    // Rolldown has inject natively (from rollup/plugin-inject logic). But if it's just a file to include, 
    // we can specify it in the input or inject specific variables.
    // Since esbuild's inject puts it at the top of the bundle, we can use `banner` or `intro` to require it if we can't do it via `inject`.
    // Actually we can just let `input` be an array if it was just side effects.
  }
});
