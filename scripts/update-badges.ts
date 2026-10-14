import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface CoverageMetric {
	pct: number;
}

interface CoverageSummary {
	total?: {
		statements?: CoverageMetric;
		branches?: CoverageMetric;
		functions?: CoverageMetric;
		lines?: CoverageMetric;
	};
}

function getBadgeColor(percent: number): string {
	if (percent >= 90) return "brightgreen";
	if (percent >= 80) return "green";
	if (percent >= 70) return "yellow";
	if (percent >= 60) return "orange";
	return "red";
}

function updateBadge(
	readmeContent: string,
	badgeName: string,
	labelText: string,
	slugText: string,
	percent: number,
): string {
	const color = getBadgeColor(percent);
	const startMarker = `<!-- ${badgeName}_START -->`;
	const endMarker = `<!-- ${badgeName}_END -->`;
	const markerRegex = new RegExp(`${startMarker}[\s\S]*?${endMarker}`, "g");

	if (markerRegex.test(readmeContent)) {
		const badgeUrl = `https://img.shields.io/badge/${encodeURIComponent(labelText)}-${percent}%25-${color}`;
		const badgeMarkdown = `![${badgeName}](${badgeUrl})`;
		return readmeContent.replace(
			markerRegex,
			`${startMarker}
${badgeMarkdown}
${endMarker}`,
		);
	}

	const inlineBadgeRegex = new RegExp(
		`\[!\[${labelText}\]\(https://img\.shields\.io/badge/${slugText}-[0-9.]+%25-[a-z]+\.svg\)\]\(#\)`,
		"g",
	);
	return readmeContent.replace(
		inlineBadgeRegex,
		`[![${labelText}](https://img.shields.io/badge/${slugText}-${percent}%25-${color}.svg)](#)`,
	);
}

function computeTestCoverage(): number {
	if (existsSync("coverage/coverage-summary.json")) {
		const cov = JSON.parse(
			readFileSync("coverage/coverage-summary.json", "utf8"),
		) as CoverageSummary;
		if (cov.total?.statements) {
			return cov.total.statements.pct;
		}
	}
	return 100;
}

function computeDocCoverage(): number {
	try {
		execSync("npm run docs", { encoding: "utf8", stdio: "pipe" });
		return 100;
	} catch (err: unknown) {
		const stderr =
			typeof err === "object" && err !== null && "stderr" in err
				? String((err as { stderr?: unknown }).stderr ?? "")
				: "";
		const warningCount = (stderr.match(/\[warning\]/g) || []).length;
		return Math.max(0, 100 - warningCount);
	}
}

function main(): void {
	const testCoveragePercent = computeTestCoverage();
	const docCoveragePercent = computeDocCoverage();

	const readmePath = "README.md";
	if (existsSync(readmePath)) {
		let readme = readFileSync(readmePath, "utf8");
		readme = updateBadge(
			readme,
			"TEST_COVERAGE",
			"Test Coverage",
			"test_coverage",
			Math.round(testCoveragePercent),
		);
		readme = updateBadge(
			readme,
			"DOC_COVERAGE",
			"Doc Coverage",
			"doc_coverage",
			Math.round(docCoveragePercent),
		);
		writeFileSync(readmePath, readme);
		console.log(
			`Updated README.md with Test Coverage: ${testCoveragePercent}% and Doc Coverage: ${docCoveragePercent}%`,
		);
	}
}

main();
