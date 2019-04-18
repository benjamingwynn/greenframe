/**
 *  AssetLoader loads assets into a local variable that can be reused in your application.
 *
 * @format
 */

export default class AssetLoader {
	static LoadSVG(url: string): Promise<() => SVGElement> {
		return new Promise(async (resolve, reject) => {
			const f = await fetch(url)
			if (f.status === 200) {
				const $outer = document.createElement("div")
				$outer.innerHTML = await f.text()
				const $svg = $outer.querySelector("svg")
				if (!$svg) throw new Error("Returned asset was not an SVG.")
				resolve(
					(): SVGElement => {
						const cloned = $svg.cloneNode(true)
						if (cloned instanceof SVGElement) {
							return cloned
						} else {
							throw new Error("Unexpected error cloning element. Element is not a HTMLElement.")
						}
					}
				)
			} else {
				reject(f.statusText || "HTTP Error " + f.status)
			}
		})
	}
}
