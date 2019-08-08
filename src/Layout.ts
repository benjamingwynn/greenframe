/** @format */

type LayoutElementAdditionalProperties = {string: string}

/** Layout object, used for quickly creating components */
export default class Layout {
	/** The document fragment of this layout. */
	public $root: DocumentFragment = document.createDocumentFragment()

	/** Add a heading, the heading count is automatically determined. */
	public h(innerText: string, idAndClasses?: string, additionalProperties?: LayoutElementAdditionalProperties) {
		let n = 1
		let e = this.$root.lastElementChild
		while (e && e.tagName[0] === "H" && n < 6) {
			n++
			e = e.lastElementChild
		}

		let hCount = "h" + n.toString()
		return this.e(hCount, innerText, idAndClasses, additionalProperties)
	}

	/** Add a paragraph. */
	public p(innerText: string, idAndClasses?: string, additionalProperties?: LayoutElementAdditionalProperties) {
		this.e("p", innerText, idAndClasses, additionalProperties)
	}

	public button(cb: (button: HTMLButtonElement) => void) {
		const $b = document.createElement("button")
		cb($b)
		this.$root.appendChild($b)
	}

	public container(id: string, cb: (div: HTMLDivElement) => HTMLElement[]) {
		const $b = document.createElement("div")
		$b.id = id
		const $$e = cb($b)
		$$e.forEach((e) => $b.appendChild(e))
		this.$root.appendChild($b)
	}

	/** create a div for containing stuff */
	public div(id: string, classList?: string) {
		const $e = document.createElement("div")
		$e.id = id
		this.$root.appendChild($e)
	}

	// public x(cb: () => HTMLElement): Layout {
	// 	const xxx = cb()
	// 	this.$root.appendChild(xxx)
	// 	return this
	// }

	/** Add an element. */
	public e(tagName: string = "div", innerHTML?: string, idAndClasses?: string, additionalProperties?: LayoutElementAdditionalProperties) {
		const $element = document.createElement(tagName)

		if (idAndClasses) {
			let id = (idAndClasses.match(/#[a-zA-Z-]*/) || [""])[0].substr(1)
			$element.id = id
			let classList = Array.from(idAndClasses.match(/\.[a-zA-Z]*/g) || [""])
			$element.className = classList.map((c) => c.trim().substr(1)).join(" ")
		}

		if (innerHTML) {
			if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6" || tagName === "label" || tagName === "p") $element.innerHTML = innerHTML
		}

		this.$root.appendChild($element)
	}

	/**
	 * Adds one or many HTMLElement's to the layout.
	 **/
	public connect($element: HTMLElement | HTMLElement[]): void {
		if (Array.isArray($element)) {
			$element.forEach(($e) => this.$root.appendChild($e))
		} else {
			this.$root.appendChild($element)
		}
	}

	/** Adds a stylesheet to the layout. */
	public css(css: string) {
		if (css.includes(":host>") || css.includes(":host >")) {
			console.warn("This layout contains a `:host >` CSS selector. This is not fully supported by all browsers in 2019, namely Safari 12.1. Content may appear bugged on that platform. See: https://caniuse.com/#feat=shadowdomv1")
		}

		// Remove "//" comments from CSS
		css = css
			.split("\n")
			.filter((line) => line.trim().indexOf("//") !== 0)
			.join("\n")

		const $link = document.createElement("link")
		$link.href = URL.createObjectURL(new Blob([css], {type: "text/css"}))
		$link.setAttribute("layout-css", "")
		$link.rel = "stylesheet"

		this.$root.appendChild($link)

		return this
	}
}
