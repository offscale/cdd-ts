const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { execFileSync, spawnSync } = require("node:child_process");
const esbuild = require("esbuild");

const JAVY_VERSION = "v3.0.1";

function resolveJavyCacheDir() {
	if (process.platform === "darwin") {
		return path.join(os.homedir(), "Library", "Caches", "binarycache");
	}
	if (process.platform === "win32") {
		const localAppData =
			process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
		return path.join(localAppData, "binarycache", "Cache");
	}
	const xdgCache =
		process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
	return path.join(xdgCache, "binarycache");
}

function getJavyPlatArch() {
	let platform;
	if (process.platform === "darwin") {
		platform = "macos";
	} else if (process.platform === "linux") {
		platform = "linux";
	} else if (process.platform === "win32") {
		platform = "windows";
	} else {
		throw new Error(`Unsupported platform: ${process.platform}`);
	}

	let arch;
	if (process.arch === "arm" || process.arch === "arm64") {
		arch = "arm";
	} else if (process.arch === "ia32" || process.arch === "x64") {
		arch = "x86_64";
	} else {
		throw new Error(`Unsupported architecture: ${process.arch}`);
	}

	return `${arch}-${platform}`;
}

async function ensureJavyBinary() {
	const checkCmd = process.platform === "win32" ? "where" : "which";
	const onPath = spawnSync(checkCmd, ["javy"], { stdio: "ignore" });
	if (onPath.status === 0) {
		return "javy";
	}

	const cacheDir = resolveJavyCacheDir();
	fs.mkdirSync(cacheDir, { recursive: true });
	const ext = process.platform === "win32" ? ".exe" : "";
	const binPath = path.join(cacheDir, `javy-${JAVY_VERSION}${ext}`);
	const legacyBinPath = path.join(cacheDir, `javy-${JAVY_VERSION}`);

	if (fs.existsSync(binPath) && fs.statSync(binPath).size > 0) {
		return binPath;
	}
	if (fs.existsSync(legacyBinPath) && fs.statSync(legacyBinPath).size > 0) {
		return legacyBinPath;
	}

	const url = `https://github.com/bytecodealliance/javy/releases/download/${JAVY_VERSION}/javy-${getJavyPlatArch()}-${JAVY_VERSION}.gz`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Downloading javy (${url}) failed with status ${response.status}`,
		);
	}
	const compressed = Buffer.from(await response.arrayBuffer());
	const decompressed = zlib.gunzipSync(compressed);
	fs.writeFileSync(binPath, decompressed, { mode: 0o755 });
	return binPath;
}

async function compileAndOptimizeWasm(jsPath, wasmPath, graftJavyBytecode) {
	const javyBin = await ensureJavyBinary();
	execFileSync(javyBin, ["compile", jsPath, "-o", wasmPath], {
		stdio: "inherit",
	});
	await optimizeExistingWasm(wasmPath, graftJavyBytecode, javyBin);
}

async function optimizeExistingWasm(
	wasmPath,
	graftJavyBytecode,
	resolvedJavyBin,
) {
	const javyBin = resolvedJavyBin || (await ensureJavyBinary());
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-ts-javy-"));
	const emptyJsPath = path.join(tmpDir, "empty.js");
	const emptyWasmPath = path.join(tmpDir, "empty.wasm");
	try {
		fs.writeFileSync(emptyJsPath, "");
		execFileSync(javyBin, ["compile", emptyJsPath, "-o", emptyWasmPath], {
			stdio: "inherit",
		});
		const compiledWasm = new Uint8Array(fs.readFileSync(wasmPath));
		const cleanWasm = new Uint8Array(fs.readFileSync(emptyWasmPath));
		const grafted = graftJavyBytecode(compiledWasm, cleanWasm);
		fs.writeFileSync(wasmPath, grafted);

		try {
			execFileSync(
				"wasm-opt",
				[
					"-Oz",
					"--strip-debug",
					"--strip-producers",
					"--strip-target-features",
					wasmPath,
					"-o",
					wasmPath,
				],
				{ stdio: "ignore" },
			);
		} catch {
			// wasm-opt is optional; grafted binary is already valid and ~4.2 MB
		}
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

async function main() {
	const { optimizeWasmJsBundle, graftJavyBytecode } = await import(
		"../dist/core/wasm-optimizer.js"
	);

	const args = process.argv.slice(2);
	if (args[0] === "--compile-wasm" && args[1] && args[2]) {
		await compileAndOptimizeWasm(args[1], args[2], graftJavyBytecode);
		return;
	}
	if (args[0] === "--wasm" && args[1]) {
		await optimizeExistingWasm(args[1], graftJavyBytecode);
		return;
	}

	const bundlePath = args[0] || "bin/cdd-ts.js";
	const injectBanner = fs.readFileSync(
		path.resolve(__dirname, "../wasm-stubs/inject.js"),
		"utf8",
	);
	const rawCode = fs.readFileSync(bundlePath, "utf8");
	const pruned = optimizeWasmJsBundle(rawCode, {
		injectBanner,
		useStripDirective: true,
	});
	const minified = esbuild.transformSync(pruned.code, {
		minify: true,
		format: "esm",
		target: "es2020",
	});
	const finalCode = minified.code.startsWith('"use strip";')
		? minified.code
		: `"use strip";
${minified.code}`;
	fs.writeFileSync(bundlePath, finalCode);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
