/** @format */

export default class AssetLoader2 {
	public static readonly ResourcePreloadContainerTag = "greenframe-resource-preload"

	private static Get(type: string, src: string) {
		const e = document.querySelector(`${AssetLoader2.ResourcePreloadContainerTag} ${type}[data-src="${src}"]`)
		if (e && !e.hasAttribute("ready")) throw new Error("Asset isn't ready but was requested. Ensure you called <Application>.start() before using this asset.")
		return e
	}

	static SVG(src: string): SVGElement {
		const eParent = AssetLoader2.Get("greenframe-preloaded-svg", src)
		if (!eParent) throw new Error("Could not get SVG from preloaded SVGs. (" + src + ")")
		const e = eParent.querySelector("svg")
		if (e instanceof SVGElement) {
			const ec = e.cloneNode(true)
			if (ec instanceof SVGElement) return ec
			throw new Error("Failed to clone SVG. (" + src + ")")
		} else {
			throw new Error("Could not get SVG from preloaded SVGs. (" + src + ")")
		}
	}

	static Image(src: string): HTMLImageElement {
		const e = AssetLoader2.Get("img", src)
		if (e instanceof HTMLImageElement) {
			const ec = e.cloneNode(true)
			if (ec instanceof HTMLImageElement) return ec
			throw new Error("Failed to clone image. (" + src + ")")
		} else {
			throw new Error("Could not get image from preloaded images. (" + src + ")")
		}
	}
}
