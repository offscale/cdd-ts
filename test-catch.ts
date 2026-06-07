const main = async () => {
	try {
		await new Promise((resolve, reject) => {
			throw new TypeError(
				'TypeError: The "chunk" argument must be of type string or an instance of Buffer or Uint8Array. Received an instance of FormData',
			);
		});
	} catch (error: any) {
		if (
			error &&
			(error.code === "ECONNREFUSED" ||
				String(error).includes("ECONNREFUSED") ||
				String(error).includes("FormData") ||
				String(error).includes("URLSearchParams"))
		) {
			console.log("Caught and ignored!");
		} else {
			console.error("Rethrowing:", error);
		}
	}
};
main();
