import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "rolldown";

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const injectBanner = fs.readFileSync(
	path.resolve(__dirname_local, "wasm-stubs/inject.js"),
	"utf8",
);

export default defineConfig({
	input: "dist/cli.js",
	output: {
		file: "bin/cdd-ts.js",
		format: "esm",
		codeSplitting: false,
		banner: `"use strip";
${injectBanner}`,
	},
	platform: "browser",
	define: {
		"process.env.NODE_ENV": '"production"',
		"import.meta.url": '"file:///cli.js"',
		__dirname: '""',
		__filename: '""',
	},
	resolve: {
		alias: {
			"node:fs/promises": path.resolve(
				__dirname_local,
				"wasm-stubs/node-fs-promises.js",
			),
			"fs/promises": path.resolve(
				__dirname_local,
				"wasm-stubs/node-fs-promises.js",
			),
			"node:fs": path.resolve(__dirname_local, "wasm-stubs/node-fs.js"),
			fs: path.resolve(__dirname_local, "wasm-stubs/node-fs.js"),
			"node:path": path.resolve(
				__dirname_local,
				"node_modules/path-browserify/index.js",
			),
			path: path.resolve(
				__dirname_local,
				"node_modules/path-browserify/index.js",
			),
			"node:os": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			os: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:crypto": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			crypto: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:child_process": path.resolve(
				__dirname_local,
				"wasm-stubs/node-child_process.js",
			),
			child_process: path.resolve(
				__dirname_local,
				"wasm-stubs/node-child_process.js",
			),
			"node:url": path.resolve(__dirname_local, "wasm-stubs/node-url.js"),
			url: path.resolve(__dirname_local, "wasm-stubs/node-url.js"),
			"node:http": path.resolve(__dirname_local, "wasm-stubs/node-http.js"),
			http: path.resolve(__dirname_local, "wasm-stubs/node-http.js"),
			"node:https": path.resolve(__dirname_local, "wasm-stubs/node-http.js"),
			https: path.resolve(__dirname_local, "wasm-stubs/node-http.js"),
			"node:events": path.resolve(__dirname_local, "wasm-stubs/node-events.js"),
			events: path.resolve(__dirname_local, "wasm-stubs/node-events.js"),
			"node:util": path.resolve(__dirname_local, "wasm-stubs/node-util.js"),
			util: path.resolve(__dirname_local, "wasm-stubs/node-util.js"),
			"node:stream": path.resolve(__dirname_local, "wasm-stubs/node-events.js"),
			stream: path.resolve(__dirname_local, "wasm-stubs/node-events.js"),
			"node:buffer": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			buffer: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:net": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			net: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:tls": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			tls: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:zlib": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			zlib: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:assert": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			assert: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:tty": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			tty: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:constants": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			constants: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:process": path.resolve(
				__dirname_local,
				"wasm-stubs/node-process.js",
			),
			process: path.resolve(__dirname_local, "wasm-stubs/node-process.js"),
			"node:async_hooks": path.resolve(
				__dirname_local,
				"wasm-stubs/node-os.js",
			),
			async_hooks: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:worker_threads": path.resolve(
				__dirname_local,
				"wasm-stubs/node-os.js",
			),
			worker_threads: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:perf_hooks": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			perf_hooks: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:v8": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			v8: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:vm": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			vm: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:inspector": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			inspector: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			"node:module": path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
			module: path.resolve(__dirname_local, "wasm-stubs/node-os.js"),
		},
	},
});
