export function stripVTControlCharacters(str) {
	return typeof str === "string"
		? str.replace(/\x1B(?:[@-Z\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
		: str;
}

export default { stripVTControlCharacters };
