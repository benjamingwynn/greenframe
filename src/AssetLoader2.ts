/** @format */

export default class AssetLoader2 {
	public static readonly ResourcePreloadContainerTag = "greenframe-preload-assets"
	private static _cachedRoot: Document | null = null

	static get root() {
		const e = document.querySelector(AssetLoader2.ResourcePreloadContainerTag)
		if (!e) throw new Error("Could not find the root AssetLoader2 element in the head of the document. Check it contains " + AssetLoader2.ResourcePreloadContainerTag)
		return e
	}

	// public static GetPreloadedRoot() {
	// 	if (!this._cachedRoot) {
	// 		const parser = new DOMParser()
	// 		const script = document.head.querySelector(AssetLoader2.ResourcePreloadContainerTag)
	// 		if (!script) throw new Error("Could not find the root AssetLoader2 element in the head of the document. Check it contains " + AssetLoader2.ResourcePreloadContainerTag)
	// 		const parsed = parser.parseFromString(script.innerHTML, "text/html")
	// 		this._cachedRoot = parsed
	// 	}
	// 	return this._cachedRoot
	// }

	private static Get(type: string, src: string) {
		const query = `${type}[data-src="${src}"]`
		const e = this.root.querySelector(query)
		if (!e) {
			throw new Error("Cannot find query:" + query)
		} else {
			if (!e.hasAttribute("ready")) throw new Error("Asset isn't ready but was requested. Ensure you called <Application>.start() before using this asset.")
			return e
		}
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

	static CSS_Cache: {[src: string]: HTMLStyleElement} = {}

	static CSS(src: string): HTMLStyleElement {
		const e = AssetLoader2.Get("greenframe-preloaded-style", src)
		if (!e) throw new Error("Could not find CSS from preloaded CSS. (" + src + ")")
		if (AssetLoader2.CSS_Cache[src]) {
			return <HTMLStyleElement>AssetLoader2.CSS_Cache[src].cloneNode(true)
		} else {
			const copy = document.createElement("style")
			copy.innerText = <string>e["innerText"]
			copy.setAttribute("greenframe-pre-rendered-css", "")
			AssetLoader2.CSS_Cache[src] = copy
			return copy
		}
	}
}
