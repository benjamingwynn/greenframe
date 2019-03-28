export function sleep (ms:number) {
	return new Promise ((resolve) => {
		if (ms <= 0) {
			resolve()
		} else {
			setTimeout(resolve, ms)
		}
	})
}
