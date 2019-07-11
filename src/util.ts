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
			n++ === nFrames ? resolve() : requestAnimationFrame(f)
		}
		requestAnimationFrame(f)
	})
}

/** Converts a ToggleCase or camelCase string to kebab-case */
export function toKebabCase(input: string): string {
	const letters = input.split("")
	let numberOfUppersInOrder = 0
	for (let index = letters.length - 2; index >= 1; index--) {
		const letter = letters[index]

		if (letter.toLowerCase() === letter) {
			// this letter is a lowercase letter
			numberOfUppersInOrder = 0
		} else {
			// this letter is an uppercase letter
			numberOfUppersInOrder++

			// if this is the first uppercase letter, add dash
			if (numberOfUppersInOrder === 1) {
				letters.splice(index, 0, "-")
			}
		}
	}
	const out = letters.join("").toLowerCase()
	return out
}
