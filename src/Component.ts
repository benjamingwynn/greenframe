/** @format */

/**
 * A custom elements wrapper for easily creating reusable components.
 *
 * Components are designed to be very easy to work with, and accept standard HTML and CSS as inputs.
 *
 * CSS used in a component is automatically parsed with `postcss` to auto-prefix properties amongst other useful actions.
 *
 * A component can either be isolated, or not isolated. Isolated components are created with Shadow Root's, or a class-based fallback system
 * for browsers that don't support ShadowDOM.
 *
 * **Important**: Any non-isolated components cannot be started in Chrome via `document.createElement()`
 *
 * @author Benjamin Gwynn
 **/
abstract class Component extends HTMLElement {
	private readonly componentCSS: string

	private static commonCSSBlobURLs: string[] = []
	private static commonCSSConcatenated: string = ""
	private static cachedComponentCSSBlobURLs: {[tagName: string]: string} = {}

	/** Setup for the component, such as adding events, etc. This should be here, and not in the constructor. */
	abstract setup(): void

	/**
	 * Add common CSS. This is added to all components constructed after this function is fired.
	 *
	 * **This is not an excuse for poor practice** - e.g. this should not be used to add a global `.row` as this will impact performance and confusion. Instead, consider defining a `row` component.
	 **/
	public static addCommonCSS(css: string) {
		Component.commonCSSConcatenated += css

		const newBlob = new Blob([css], {type: "text/css"})
		Component.commonCSSBlobURLs.push(URL.createObjectURL(newBlob))
	}

	/** Defines whether to use `display:"none"` on an element before its CSS has been parsed. */
	private static hideBeforeCSS = true

	/** Defines whether to force elements to use `style` tags for their CSS, or whether to use blobs. True to force blobs, false to force `style` tags. Leaving `undefined` forces neither option and will automatically decide whether it's appropriate. */
	private static forceCSSMethod: boolean | undefined = undefined

	/**
	 * Does the following:
	 * * Removes `//` comments from CSS.
	 * * Auto-prefixes 2019 browser vendor prefixes (user-select, etc)
	 */
	private async parseCSS(inputCSS: string): Promise<string> {
		// TODO: This should start a worker thread that parses the CSS
		return inputCSS
	}

	/** Represents the root of the component where other Elements should be appended to and modified. Internally, this is either the component itself or a shadow root, depending on the components isolation setting. */
	public $root: Component | ShadowRoot | HTMLElement

	/** Construct with initialHTML and initialCSS. This is the HTML and CSS the element will be constructed with, along with the common stuff. */
	constructor(initialHTML: string = "", initialCSS: string = "", private isolate: boolean = true) {
		super()

		// Isolate determines if the CSS should attempt to isolate
		if (this.isolate) {
			this.$root = this.attachShadow({mode: "open"})
		} else {
			this.$root = this
		}

		this.$root.innerHTML = initialHTML
		this.componentCSS = initialCSS
	}

	/**
	 * Adds an element to the component.
	 * @deprecated use `<Component>.$root.appendChild()` instead.
	 * */
	public addElement($element: HTMLElement): void {
		console.warn("`<Component>.addElement()` is deprecated. Use `<Component>.$root.appendChild()` instead.")
		this.$root.appendChild($element)
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
	public $c(query: string, $root: HTMLElement | ShadowRoot = this.$root): Component {
		const $r = this.$(query, $root)
		if ($r instanceof Component) return $r
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
	public $is(query: string, $root?: HTMLElement | ShadowRoot): boolean {
		return !!this.$$(query, undefined, $root).length
	}

	/** Returns the element, or returns null if the element doesn't exist. */
	public $_(query: string, $root?: HTMLElement | ShadowRoot): HTMLElement | null {
		if (this.$is(query, $root)) {
			return this.$(query, $root)
		} else {
			return null
		}
	}

	/** Connect this component to another component, or a HTML element. */
	public connectTo($to: HTMLElement | Component) {
		if ($to instanceof Component) {
			$to.$root.appendChild(this)
		} else {
			$to.appendChild(this)
		}
	}

	/** Returns whether the element is visible by the UA or not. */
	public get visible(): boolean {
		return this.getBoundingClientRect().top <= window.innerHeight && this.getBoundingClientRect().bottom > 0 && getComputedStyle(this).visibility !== "hidden"
	}

	private connectedCallbackRan = false

	/** Shortcut to get CSS variable value */
	public getCssVar(variableName: string) {
		return window.getComputedStyle(this).getPropertyValue(variableName)
	}

	/** Returns the class name of the component as a string. */
	protected getClassName(): string {
		// @ts-ignore
		if (this.__proto__ && this.__proto__.constructor && this.__proto__.constructor.name) return this.__proto__.constructor.name
		return this.tagName.toLowerCase()
	}

	public async connectedCallback() {
		if (this.connectedCallbackRan) {
			console.warn(this, "connected callback already ran.")
			return
		}

		// Only ever run this function once
		this.connectedCallbackRan = true

		// Set the [component] attribute on this element
		this.setAttribute("component", "")

		// Hide this element
		if (Component.hideBeforeCSS) {
			this.style.display = "none"
		}

		// If the CSS is isolated, add blob tags defining the CSS
		if (this.isolate) {
			// Add the common CSS
			for (let i = 0; i < Component.commonCSSBlobURLs.length; i++) {
				const $link = document.createElement("link")
				$link.setAttribute("common-css", "")
				$link.rel = "stylesheet"
				$link.href = Component.commonCSSBlobURLs[i]
				this.$root.appendChild($link)
			}
		}

		// If we don't have the blob CSS for this, create it
		if (!Component.cachedComponentCSSBlobURLs[this.tagName]) {
			const parsedCSS = await this.parseCSS(this.componentCSS)
			const cssBlob = new Blob([parsedCSS], {type: "text/css"})
			// and put it in cache
			Component.cachedComponentCSSBlobURLs[this.tagName] = URL.createObjectURL(cssBlob)
		}

		// Add the element CSS via a <link> element
		const $link = document.createElement("link")
		$link.setAttribute("element-css", "")
		$link.rel = "stylesheet"
		$link.href = Component.cachedComponentCSSBlobURLs[this.tagName] // get from cache
		this.$root.appendChild($link)

		if (Component.hideBeforeCSS) {
			$link.onload = () => (this.style.display = "")
		}

		// Run the setup function
		this.setup()
	}
}

/** Add default styling. */
Component.addCommonCSS(`
	:host {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, system-ui, sans-serif;
		font-size: 1em;
		display: block;
		cursor: default;
		user-select: none;
		box-sizing: border-box;
	}

	h1, h2, h3, h4, h5, h6, button, p, div, main, aside, section, span, img {
		display: block;
		box-sizing: border-box;
		outline: none;
		overflow-y: hidden;
		overflow-x: hidden;
		-webkit-tap-highlight-color: transparent;
		-webkit-user-drag: none;
		-webkit-appearance: none;
		margin: 0;
		flex: auto 0 0;
	}

	a, button {
		display: inline-block;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
		border: none;
		font-size: 1em;
		padding: 0;
	}

	a *, button * {
		cursor: inherit;
	}

	style, script, link, meta {
		display: none !important;
	}

	[hidden] {
		display: none;
	}

	slot {
		display: block;
	}

	button {
		background: none;
	}
`)

export default Component
