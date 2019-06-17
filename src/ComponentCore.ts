/** @format */

import Activity from "./Activity"

/** @format */

/**
 *  A BaseComponent is a component that does not have an `app` property. It can run without an App. You should use `Component` though.
 *
 * @format
 */

export default abstract class ComponentCore extends HTMLElement {
	private static commonCSSBlobs: string[] = []
	private static commonCSSSource: string[] = []

	/** Setup for the component, such as adding events, etc. This should be here, and not in the constructor. */
	abstract setup(): void | Promise<void>

	/**
	 * Add common CSS. This is added to all components constructed after this function is fired.
	 *
	 * **This is not an excuse for poor practice** - e.g. this should not be used to add a global `.row` as this will impact performance and confusion. Instead, consider defining a `row` component.
	 **/
	public static addCommonCSS(css: string) {
		ComponentCore.commonCSSBlobs.push(URL.createObjectURL(new Blob([css], {type: "text/css"})))
		ComponentCore.commonCSSSource.push(css)
	}

	/** Defines whether to use `display:"none"` on an element before its CSS has been parsed. */
	private static hideBeforeCSS = true

	/** Defines whether to force elements to use `style` tags for their CSS, or whether to use blobs. True to force blobs, false to force `style` tags. Leaving `undefined` forces neither option and will automatically decide whether it's appropriate. */
	private static forceCSSMethod: boolean | undefined = undefined

	/** Represents the root of the component where other Elements should be appended to and modified. Internally, this is either the component itself or a shadow root, depending on the components isolation setting. */
	public $root: ComponentCore | ShadowRoot | HTMLElement

	/** Construct with initialHTML and initialCSS. This is the HTML and CSS the element will be constructed with, along with the common stuff. */
	constructor(private isolate: boolean = true) {
		super()

		// Isolate determines if the CSS should attempt to isolate
		if (this.isolate) {
			this.$root = this.attachShadow({mode: "open"})
		} else {
			this.$root = this
		}
	}

	private static DOMParser = new DOMParser()

	public hide() {
		this.setAttribute("hidden", "")
	}

	public show() {
		this.removeAttribute("hidden")
	}

	/** Inserts raw HTML markup into the component */
	public html(html: string) {
		// this.$root.innerHTML += html
		const parser = new DOMParser()
		const doc = parser.parseFromString(`<component-inner>${html}</component-inner>`, "text/html")
		const inner = doc.querySelectorAll("component-inner > *")
		if (!inner.length) throw new Error("Could not select inner component from parsed HTML string.")
		for (let i = 0; i < inner.length; i++) this.$root.appendChild(inner[i])

		if (this.$has("slot")) {
			console.warn(this.getClassName(), "This component contains a `slot` element. Slotted content is not fully supported by all browsers in 2019, namely Safari 12.1. Content may appear bugged on that platform. See: https://caniuse.com/#feat=shadowdomv1")
		}
	}

	/** Adds a stylesheet to the component. */
	public css(css: string) {
		if (css.includes(":host>") || css.includes(":host >")) {
			console.warn(this.getClassName(), "This component contains a `:host >` CSS selector. This is not fully supported by all browsers in 2019, namely Safari 12.1. Content may appear bugged on that platform. See: https://caniuse.com/#feat=shadowdomv1")
		}

		const $link = document.createElement("link")
		$link.href = this.isolate ? URL.createObjectURL(new Blob([css], {type: "text/css"})) : this.parseCSS(css)
		$link.setAttribute("element-css", "")
		$link.rel = "stylesheet"

		this.$root.appendChild($link)
	}

	public static ParseShorthandElement(tagName: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p", args: string[]): HTMLElement {
		let props: string = ""
		let inner: string = ""

		for (let i = 0; i < args.length; i++) {
			const arg = args[i]
			if ((arg.includes("#") || arg.includes(".")) && !arg.includes(" ")) {
				props = arg
			} else {
				inner = arg
			}
		}

		// TODO: Attribute support`

		let id = (props.match(/#[a-zA-Z-]*/) || [""])[0].substr(1)
		let classList = Array.from(props.match(/\.[a-zA-Z]*/g) || [""])
		const $element = document.createElement(tagName)
		$element.id = id
		$element.innerHTML = inner
		$element.className = classList.join(" ")
		return $element
	}

	/** Quickly add a paragraph to the component. */
	public p(a: string, b?: string) {
		this.connect(ComponentCore.ParseShorthandElement("p", Array.from(arguments)))
	}

	/** Quickly add a heading to the component. */
	public h(a: string, b?: string) {
		this.connect(ComponentCore.ParseShorthandElement("h1", Array.from(arguments)))
	}

	/**
	 * Adds an element to the component.
	 **/
	public connect($element: HTMLElement | HTMLElement[], parent: string | HTMLElement | ShadowRoot = this.$root): void {
		let p: HTMLElement | ShadowRoot

		if (typeof parent === "string") {
			p = this.$(parent)
		} else {
			p = parent
		}

		if (Array.isArray($element)) {
			$element.forEach(($e) => p.appendChild($e))
		} else {
			p.appendChild($element)
		}
	}

	/** Find a single element and return it. Errors if the element does not exist. To find an element that may exist, use `$_` */
	public $(query: string, $root: HTMLElement | ShadowRoot = this.$root): HTMLElement {
		if (!$root) throw new Error("Missing root for the query.")

		const $e = $root.querySelector(query)

		if ($e && $e instanceof HTMLElement) {
			return $e
		}

		throw new Error(`Selector on CustomElement failed for selectorQuery: ${query}`)
	}

	/** Short-hand for selecting `Component` items from the current parent `Component`. Throws fatal error if the component doesn't exist or if the component is a standard HTMLElement. */
	public $c(query: string, $root: HTMLElement | ShadowRoot = this.$root): ComponentCore {
		const $r = this.$(query, $root)
		if ($r instanceof ComponentCore) return $r
		throw new Error(`Selector on CustomElement failed for selectorQuery as the query is not a valid Component: ${query}`)
	}

	/** Find multiple elements as an array. If no elements exist, returns an empty array. */
	public $$(query: string, loop?: ($e: HTMLElement, index: number) => void, $root: HTMLElement | ShadowRoot = this.$root): HTMLElement[] {
		if (!$root) throw new Error("Missing root for document query.")
		const $$e = $root.querySelectorAll(query)
		const $$r: HTMLElement[] = []
		for (let i = 0; i < $$e.length; i += 1) {
			const $e = $$e[i]
			if ($e instanceof HTMLElement) {
				if (loop) {
					loop($e, i)
				} else {
					$$r.push($e)
				}
			}
		}

		// try getting from real root
		if ($$r.length === 0 && $root === this.shadowRoot && this.shadowRoot.querySelector("slot")) {
			return this.$$(query, loop, this)
		}

		return $$r
	}

	/** Returns whether or not the element exists as a boolean. */
	public $has(query: string, $root?: HTMLElement | ShadowRoot): boolean {
		return !!this.$$(query, undefined, $root).length
	}

	/** Returns the element, or returns null if the element doesn't exist. */
	public $_(query: string, $root?: HTMLElement | ShadowRoot): HTMLElement | null {
		if (this.$has(query, $root)) {
			return this.$(query, $root)
		} else {
			return null
		}
	}

	/** Connect this component to another component, or a HTML element. */
	public connectTo($to: HTMLElement | ComponentCore) {
		if ($to instanceof ComponentCore) {
			$to.$root.appendChild(this)
		} else {
			$to.appendChild(this)
		}
	}

	private _parentActivity?: Activity

	/** Gets the activity the component is attached to. */
	public getActivity(): Activity | null {
		if (this._parentActivity) return this._parentActivity
		let p: any = this
		while (p.host || p.parentNode) {
			p = p.host || p.parentNode
			if (p instanceof Activity) {
				return (this._parentActivity = p)
			}
		}
		return null
	}

	protected connectedCallbackRan = false
	protected connectedCallbackFinished = false

	/** Shortcut to get CSS variable value */
	public getCssVar(variableName: string) {
		return window.getComputedStyle(this).getPropertyValue(variableName)
	}

	/** Shortcut to set a CSS variable value */
	public setCssVar(variableName: string, newValue: string) {
		this.style.setProperty(variableName, newValue)
	}

	/** Returns the class name of the component as a string. */
	protected getClassName(): string {
		// @ts-ignore
		if (this.__proto__ && this.__proto__.constructor && this.__proto__.constructor.name) return this.__proto__.constructor.name
		return this.tagName.toLowerCase()
	}

	private parseCSS(css: string): string {
		return URL.createObjectURL(
			new Blob(
				[
					"/* Greenframe has modified this file for use in a non-isolated state. */\n" +
						css
							.split("\n")
							.map((line) => {
								if (line.includes(":host")) {
									const r = /\([a-zA-Z.-\[\]\#]*\)/
									const sel = line.match(r) || [""]
									let extra = ""
									if (sel[0]) {
										extra = sel[0].replace("(", "").replace(")", "")
									}

									return this.tagName + extra + "{\n"
								} else if (line.includes("{") && !line.includes("@") && !line.includes("from {") && !line.includes("from{") && !line.includes("to {") && !line.includes("to{")) {
									return this.tagName + " " + line.split(",").join(", " + this.tagName) + "\n"
								} else {
									return line + "\n"
								}
							})
							.join(""),
				],
				{type: "text/css"}
			)
		)
	}

	public async connectedCallback(): Promise<void> {
		if (this.connectedCallbackRan) {
			console.warn(this, "connected callback already ran.")
			return
		}

		// Only ever run this function once
		this.connectedCallbackRan = true

		// Set the [component] attribute on this element
		this.setAttribute("component", "")

		// Hide this element
		if (ComponentCore.hideBeforeCSS) {
			this.style.display = "none"
		}

		// If the CSS is isolated, add blob tags defining the CSS
		if (this.isolate) {
			// if (this.tagName.toLowerCase() === "component-title-bar") debugger

			// Add the common CSS
			for (let i = 0; i < ComponentCore.commonCSSBlobs.length; i++) {
				const $link = document.createElement("link")
				$link.setAttribute("common-css", "")
				$link.rel = "stylesheet"
				$link.href = ComponentCore.commonCSSBlobs[i]
				this.$root.appendChild($link)
			}
		} else {
			// non isolated common CSS
			for (let i = 0; i < ComponentCore.commonCSSSource.length; i++) {
				const $link = document.createElement("link")
				$link.setAttribute("common-css", "")
				$link.rel = "stylesheet"
				$link.href = this.parseCSS(ComponentCore.commonCSSSource[i])
				this.$root.appendChild($link)
			}
		}

		let total = 1
		let loaded = 0
		if (ComponentCore.hideBeforeCSS) {
			this.$$("link[rel='stylesheet']").forEach(($link) => {
				total++
				$link.onload = () => {
					loaded++
					if (total === loaded) {
						this.style.display = ""
					}
				}
			})
			if (!total) this.style.display = ""
		}

		// Run the setup function
		await this.setup()
		loaded++
		if (total === loaded) {
			this.style.display = ""
		}

		this.connectedCallbackFinished = true
	}
}
