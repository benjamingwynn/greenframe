/** @format */

import Activity from "./Activity"
import Layout from "./Layout"

/** @format */

export type ComponentLoadBehavior = "hideBeforeReady" | "useLoadAttribute" | false

/**
 *  ComponentCore is a component that does not have an `app` property. It can run without an App. You should use `Component` though.
 */

export default abstract class ComponentCore extends HTMLElement {
	private static commonCSSBlobs: string[] = []
	private static commonCSSSource: string[] = []
	private static CachedLayouts: {[tag: string]: DocumentFragment} = {}

	/**
	 * The layout of the component.
	 *
	 * Where possible you should use this on your Components, it allows Greenframe to cache the layout of the component prior to `setup()`, if your CSS is unchanging, put it here.
	 *
	 * **This is a work in progress and may change at any time.**
	 */
	layout: ((root: Layout) => void) | undefined

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

	/**
	 * Defines the components load behavior before its CSS has been parsed and it's setup is complete:
	 * * `"hideBeforeReady"` - hide a component before it is ready. (default)
	 * * `"useLoadAttribute"` - sets the `load` attribute at the components connection and removes it when it's ready.
	 */
	protected loadBehavior: ComponentLoadBehavior = "hideBeforeReady"

	/** Defines whether to force elements to use `style` tags for their CSS, or whether to use blobs. True to force blobs, false to force `style` tags. Leaving `undefined` forces neither option and will automatically decide whether it's appropriate. */
	private static forceCSSMethod: boolean | undefined = undefined

	/** Represents the root of the component where other Elements should be appended to and modified. Internally, this is either the component itself or a shadow root, depending on the components isolation setting. */
	public $root: ComponentCore | ShadowRoot | HTMLElement | DocumentFragment

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

	private static HTMLInsertCount: number = 0
	/** Inserts raw HTML markup into the component. For performance reasons this should be used sparingly, like when inserting SVG's or existing HTML. */
	public html(html: string) {
		if (ComponentCore.HTMLInsertCount++ > 100) {
			console.warn("🌳🏗⚠️ Heads up! You're creating a lot of elements with <Component>.html() - this will affect performance, consider using the DOM instead to add elements.")
		}
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

		// Remove "//" comments from CSS
		// TODO: performance assessment
		css = css
			.split("\n")
			.filter((line) => line.trim().indexOf("//") !== 0)
			.join("\n")

		const $link = document.createElement("link")
		$link.href = this.isolate ? URL.createObjectURL(new Blob([css], {type: "text/css"})) : this.componentCSStoIsolatedCSS(css)
		$link.setAttribute("element-css", "")
		$link.rel = "stylesheet"

		this.$root.appendChild($link)
	}

	/** @deprecated */
	private static ParseShorthandElement(tagName: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p", args: string[]): HTMLElement {
		let props: string = ""
		let inner: string = ""

		// TODO: ParseShorthandElement(..., [".whatever", ".whatever"] ) causes invalid element creation

		if (args.length === 1) {
			inner = args[0]
		} else {
			for (let i = 0; i < args.length; i++) {
				const arg = args[i]
				if ((arg.includes("#") || arg.includes(".")) && !arg.includes(" ")) {
					props = arg
				} else {
					inner = arg
				}
			}
		}

		// TODO: Attribute support

		let id = (props.match(/#[a-zA-Z-]*/) || [""])[0].substr(1)
		let classList = Array.from(props.match(/\.[a-zA-Z]*/g) || [""])
		const $element = document.createElement(tagName)
		$element.id = id
		$element.innerHTML = inner
		$element.className = classList.map((c) => c.trim().substr(1)).join(" ")
		return $element
	}

	/** @deprecated Quickly add a paragraph to the component. */
	public p(a: string, b?: string) {
		this.connect(ComponentCore.ParseShorthandElement("p", Array.from(arguments)))
	}

	/** @deprecated Quickly add a heading to the component. */
	public h(a: string, b?: string) {
		let n = 1
		let e = this.$root.lastElementChild
		while (e && e.tagName[0] === "H" && n < 6) {
			n++
			e = e.lastElementChild
		}

		let hCount = "h" + n.toString()
		if (hCount === "h1" || hCount === "h2" || hCount === "h3" || hCount === "h4" || hCount === "h5" || hCount === "h6") {
			this.connect(ComponentCore.ParseShorthandElement(hCount, Array.from(arguments)))
		} else {
			throw new Error("Unexpected H count, this is a Greenframe implementation error.")
		}
	}

	/**
	 * Adds an element to the component.
	 **/
	public connect($element: HTMLElement | HTMLElement[], parent: string | HTMLElement | ShadowRoot | DocumentFragment = this.$root): void {
		let p: HTMLElement | ShadowRoot | DocumentFragment

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
	public $(query: string, $root: HTMLElement | ShadowRoot | DocumentFragment = this.$root): HTMLElement {
		if (!$root) throw new Error("Missing root for the query.")

		const $e = $root.querySelector(query)

		if ($e && $e instanceof HTMLElement) {
			return $e
		}

		throw new Error(`Selector on CustomElement failed for selectorQuery: ${query}`)
	}

	/** Short-hand for selecting `Component` items from the current parent `Component`. Throws fatal error if the component doesn't exist or if the component is a standard HTMLElement. */
	public $c(query: string, $root: HTMLElement | ShadowRoot | DocumentFragment = this.$root): ComponentCore {
		const $r = this.$(query, $root)
		if ($r instanceof ComponentCore) return $r
		throw new Error(`Selector on CustomElement failed for selectorQuery as the query is not a valid Component: ${query}`)
	}

	/** Find multiple elements as an array. If no elements exist, returns an empty array. */
	public $$(query: string, loop?: ($e: HTMLElement, index: number) => void, $root: HTMLElement | ShadowRoot | DocumentFragment = this.$root): HTMLElement[] {
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
		const $e = this.$$(query)[0]
		if ($e) {
			return $e
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

	/** Connect this component, and wait for it to finish loading before resolving a promise. */
	public connectToAndWait($to: HTMLElement | ComponentCore): Promise<void> {
		return new Promise((resolve) => {
			this.connectTo($to)
			const f = () => {
				if (this.connectedCallbackFinished) {
					resolve()
				} else {
					requestAnimationFrame(f)
				}
			}
			requestAnimationFrame(f)
		})
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

	/** Shortcut to set a CSS variable value, ensure your variable name is written as kebab-case (--like-this) */
	public setCssVar(variableName: string, newValue: string) {
		this.style.setProperty(variableName, newValue)
	}

	/** Returns the class name of the component as a string. */
	protected getClassName(): string {
		// @ts-ignore
		if (this.__proto__ && this.__proto__.constructor && this.__proto__.constructor.name) return this.__proto__.constructor.name
		return this.tagName.toLowerCase()
	}

	private uniqueClass: string = ""
	private componentCSStoIsolatedCSS(css: string): string {
		if (!this.uniqueClass) {
			this.uniqueClass =
				".gf-" +
				btoa(Math.random().toString())
					.split("=")
					.join("A")
			this.classList.add(this.uniqueClass.substr(1))
		}

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

									return this.uniqueClass + extra + "{\n"
								} else if (line.includes("{") && !line.includes("@") && !line.includes("from {") && !line.includes("from{") && !line.includes("to {") && !line.includes("to{")) {
									return this.uniqueClass + " " + line.split(",").join(", " + this.uniqueClass) + "\n"
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

		// Set the tabIndex of the component to -1. This stops TAB and SHIFT+TAB inside of components from escaping.
		this.tabIndex = -1

		if (this.loadBehavior === "hideBeforeReady") {
			this.style.display = "none"
		} else if (this.loadBehavior === "useLoadAttribute") {
			this.setAttribute("load", "")
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
				$link.href = this.componentCSStoIsolatedCSS(ComponentCore.commonCSSSource[i])
				this.$root.appendChild($link)
			}
		}

		let total = 1 // (1 is always in total due to self-load, others are added via stylesheet)
		let loaded = 0
		if (this.loadBehavior) {
			this.$$("link[rel='stylesheet']").forEach(($link) => {
				total++
				$link.onload = () => {
					loaded++
					if (total === loaded) {
						if (this.loadBehavior === "hideBeforeReady") {
							this.style.display = ""
						} else if (this.loadBehavior === "useLoadAttribute") {
							this.removeAttribute("load")
						}
					}
				}
			})

			if (!total) {
				if (this.loadBehavior === "hideBeforeReady") {
					this.style.display = ""
				} else if (this.loadBehavior === "useLoadAttribute") {
					this.removeAttribute("load")
				}
			}
		}

		if (this.layout) {
			// create the layout
			let frag: DocumentFragment
			if (ComponentCore.CachedLayouts[this.tagName]) {
				frag = ComponentCore.CachedLayouts[this.tagName]
				console.debug("Loaded existing cached layout for", this.tagName)
			} else {
				const layout = new Layout()
				this.layout(layout)
				frag = ComponentCore.CachedLayouts[this.tagName] = layout.$root
				console.debug("Generated new layout from fragment:", frag)
			}
			this.$root.appendChild(frag.cloneNode(true))
		}

		// Run the setup function
		await this.setup()

		loaded++ // (1 is always in total due to self-load, others are added via stylesheet)
		if (total === loaded) {
			if (this.loadBehavior === "hideBeforeReady") {
				this.style.display = ""
			} else if (this.loadBehavior === "useLoadAttribute") {
				this.removeAttribute("load")
			}
		}

		this.connectedCallbackFinished = true
	}

	private _uid?: string
	/** Get a unique ID for the component */
	public get uid() {
		return (
			this._uid ||
			(this._uid = (() =>
				"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
					const r = (Math.random() * 16) | 0,
						v = c == "x" ? r : (r & 0x3) | 0x8
					return v.toString(16)
				}))())
		)
	}
}
