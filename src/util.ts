/** @format */

/** Wait a number of seconds before resolving. */
export function sleep(ms: number) {
	return new Promise((resolve) => {
		if (ms <= 0) {
			resolve()
		} else {
			setTimeout(resolve, ms)
		}
	})
}

/** Wait a specified number of frames before resolving. */
export function sleepFrames(nFrames: number) {
	return new Promise((resolve) => {
		let n = 0
		const f = () => {
			if (n++ === nFrames) {
				resolve()
			} else {
				requestAnimationFrame(f)
			}
		}
		requestAnimationFrame(f)
	})
}

/** Converts an input to kebab-case */
export function toKebabCase(input: string): string {
	let output: string = ""
	input.split("").forEach((char, index) => {
		if (char.toUpperCase() === char) {
			// this is an upper case character
			if (index !== 0) {
				output += "-"
			}

			output += char.toLowerCase()
		} else {
			output += char
		}
	})
	return output
}
