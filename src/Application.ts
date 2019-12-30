/** @format */

import ComponentCore from "./ComponentCore"
import Activity from "./Activity"
import {toKebabCase} from "./util"
import {ModalComponent, ErrorActivity, util, DOMUtil, Component} from "./index"
import AssetLoader2 from "./AssetLoader2"

/** The colour scheme for the component. This is a simple way to set CSS variables for different schemes. Greenframe will automatically decide what's best for the user. */
export type ColorSchemaName = "dark" | "light" | "highContrast"

export type ColorSchema = {[customProperty: string]: string}

/** An exception that is thrown when a color scheme the app tries to switch to does not exist. */
class ColorSchemaDoesNotExistError extends Error {}

/** The root of the application. This will attach to the body. */
class ApplicationRoot extends ComponentCore {
	constructor() {
		// Do not isolate the root, this will allow us to use external scripts that require direct access to the document root, such as SSO.
		super(false)
	}

	public setup(): void {
		this.css(`
			/* Default activity variables */
			:host {
				--activity-top: 0px;
				--activity-left: 0px;
				--activity-bottom: 0px;
				--activity-right: 0px;
				--activity-height: calc(100vh - var(--activity-bottom) - var(--activity-top));
				--activity-width: calc(100vw - var(--activity-left) - var(--activity-right));
				--animation-time: 0.3s;

				animation: fadeIn 0.15s;
				animation-fill-mode: both;

				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
			}

			@keyframes fadeIn {
				from {
					opacity:0;
					visibility: hidden;
				}
				to {
					opacity:1;
					visibility: visible;
				}
			}

			.fixed-component {
				transition: all 0.3s;
				z-index: 2;
			}
		`)
	}
}

/**
 * Application.ts holds application related functions. It splits the Activity namespace up, so that the activity is free to do only activity things. Only one application may exist per window.
 */
export default class Application {
	/** Reference to the root object of the application. */
	public $root: ApplicationRoot

	/** Declares whether applications should throw a fatal error if modals cannot be created from their hashchange handlers. */
	static ThrowFatalOnNullModalObject: boolean = true

	/** Reference to the current title element. */
	public $title: HTMLTitleElement

	/** Time this was created. */
	private constructTime: number

	/** The current color scheme of the application. */
	private currentColorScheme: ColorSchemaName = Application.GetDefaultColorScheme()

	/** Registered color schemes as stylesheet elements. */
	private registeredColorSchemaStylesheets: {[key in ColorSchemaName]?: HTMLStyleElement} = {}

	private registeredColorSchemas: {[key in ColorSchemaName]?: ColorSchema} = {}

	/** Returns the CSS variable for the current ColorSchema if we currently have a variable declared, if we don't then this function returns a default. */
	public getSchemaProperty(prop: string): string {
		const cs = this.registeredColorSchemas[this.currentColorScheme]
		if (cs && cs[prop]) {
			return "var(--schema-" + toKebabCase(prop) + ")"
		} else {
			console.warn(prop, "is not registered in the color scheme:", this.currentColorScheme)
			return `hotpink /* add ${prop} to your ${this.currentColorScheme} ColorSchema to override this */`
		}
	}

	/** Returns the default color scheme according to the User Agent. */
	private static GetDefaultColorScheme(): ColorSchemaName {
		const useScheme = localStorage.getItem("greenframe-use-scheme")
		if (useScheme === "light" || useScheme === "dark" || useScheme === "highContrast") {
			console.log("Device colorscheme overriden by localStorage['greenframe-use-scheme'] =", useScheme)
			return useScheme
		} else {
			console.log("Detecting colorscheme via media query")
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
	}

	public registerColorScheme(name: ColorSchemaName, schema: ColorSchema) {
		this.registeredColorSchemas[name] = schema
		const $style = document.createElement("style")
		$style.setAttribute("color-schema", name)

		$style.innerHTML = this.$root.tagName + " {"
		for (let item in schema) {
			$style.innerHTML += "--schema-" + toKebabCase(item) + ": " + schema[item] + ";" + "\n"
		}
		$style.innerHTML += "}"
		console.log("Created schema", $style)
		this.registeredColorSchemaStylesheets[name] = $style
	}

	/**
	 * Sets up a new color schema to use for the application.
	 *
	 * @throws ColorSchemaDoesNotExistError
	 **/
	public setColorSchema(newSchema: ColorSchemaName, remember?: boolean) {
		// Check the colour scheme exists
		const $schema = this.registeredColorSchemaStylesheets[newSchema]
		if (!$schema) {
			throw new ColorSchemaDoesNotExistError()
		}

		// Target the old stylesheets
		this.$root.$$("style[color-schema]").forEach(($s) => $s.remove())

		// Add the stylesheet
		this.$root.$root.appendChild($schema)

		if (remember) {
			localStorage.setItem("greenframe-use-scheme", newSchema)
		}
	}

	/** The state of the application as a string, in Memehub this is used for determining if the user is logged out or not. */
	private _state: string = this.defaultState

	public get state(): string {
		return this._state
	}

	public set state(newState: string) {
		this._state = newState
		this.unregisterFixedComponents()

		if (this.currentActivityStartedVia === "route") this.routeChanged(false)

		if (this.appSetup) this.appSetup(newState)
	}

	/** Fires an app state update event without actually changing the state. */
	public refresh() {
		this.state = this.state
	}

	constructor(public readonly applicationName, private defaultState = "default", private appSetup?: (state: string) => void) {
		this.constructTime = performance.now()

		this.registerComponent(ApplicationRoot)
		this.$root = new ApplicationRoot()

		// Create title if none exists
		if (!document.head.querySelector("title")) {
			const $newTitle = document.createElement("title")
			document.head.appendChild($newTitle)
		}

		// Setup the title of the window
		this.$title = <HTMLTitleElement>document.head.querySelector("title")

		// Stop browsers from opening files when dragged in

		window.addEventListener("dragover", (ev) => {
			ev.preventDefault()
		})
		window.addEventListener("drop", (ev) => {
			ev.preventDefault()
		})
	}

	/** Returns whether the application is in PWA "standalone" mode as as a boolean. */
	public isAppInstalled(): boolean {
		return window.matchMedia("(display-mode: standalone)").matches
	}

	/** The currently active route. */
	private currentRoute: string = ""

	/** Returns whether the specified activity is currently active */
	public isActivityActive(test: Activity) {
		const activities = this.$root.querySelectorAll("[activity]")
		return activities[activities.length - 1] === test
	}

	/** Whether the user has navigated since the page has loaded. */
	private navigated: boolean = false

	/** The currently constructed activity route, i.e. what class is being used. */
	private currentlyConstructedActivity?: Function

	/** Handles the change of the current route */
	private routeChanged(initial: boolean, route: string = location.pathname) {
		if (!initial) this.navigated = true

		if (this.currentRoute === route) {
			if (this.routes[route]() === this.currentlyConstructedActivity) {
				if (this.hash === this.lastHash) {
					console.warn("Refreshing the current activity as the router function specifies it should remain the same.")
					this.refreshCurrentActivity()
				} else {
					console.warn("Just firing hashChange.")
					this.hashChange()
				}

				return
			} else {
				console.warn("Routing to a new function as the router specifies.")
			}
		}

		this.currentRoute = route

		console.debug("Route changed to:", route)

		// Register the route if it's not registered
		let activityTagName: string
		const r = this.routes[route]
		if (typeof r === "function") {
			this.currentlyConstructedActivity = r()
			activityTagName = this.registerComponent(this.currentlyConstructedActivity, undefined, true)
		} else if (this.notFoundActivity) {
			activityTagName = this.registerComponent(this.notFoundActivity, undefined, true)
		} else {
			throw new Error("No activity exists at this route, and there is no handler for 404's.")
		}

		this.startActivityViaTag(activityTagName, !!initial, this.getPageArguments())
		this.currentActivityStartedVia = "route"
	}

	/** Starts an activity without routing to it. This can be used when the user needs to be taken to an Activity that shouldn't be accessible via the address bar or UA history. The activity must be passed as it's class. */
	public startActivityWithoutRouting(activityClass: Function, args?: {[key: string]: string}) {
		this.currentActivityStartedVia = "startActivityWithoutRouting"
		this.currentlyConstructedActivity = activityClass
		const activityTagName = this.registerComponent(activityClass, undefined, true)
		this.startActivityViaTag(activityTagName, false, args || this.getPageArguments())
	}

	private static ErrorActivityTagName = "activity-error"
	public registerErrorActivity(activityClass: Function) {
		this.registerComponent(activityClass, Application.ErrorActivityTagName)

		let firedErrorActivity: boolean = false

		const startErrorActivity = (ex: Error) => {
			if (firedErrorActivity) {
				console.error("We've already attempted to start the error activity, but there was an additional error prior to creating the error activity. That's bad.")
				return
			}

			firedErrorActivity = true

			// @ts-ignore
			const activity: any = new activityClass(ex)

			if (activity instanceof ErrorActivity) {
				this.$root.connect(activity)
			} else {
				console.error("The activity you registered earlier with `<Application>.registerErrorActivity()` doesn't seem to be a valid ErrorActivity.")
			}
		}

		window.addEventListener("error", (event) => {
			if (event.error instanceof Error) {
				startErrorActivity(event.error)
			} else {
				console.error("I caught a global error, but it was of an invalid type to be handled by an ErrorActivity.")
			}
		})

		window.addEventListener("unhandledrejection", (event) => {
			if (event.reason instanceof Error) {
				startErrorActivity(event.reason)
			} else {
				console.error("I caught a global **Unhandled Promise Rejection** error, but it was of an invalid type to be handled by an ErrorActivity.")
			}
		})
	}

	private notFoundActivity?: Function

	public registerNotFoundActivity(activity: Function) {
		if (this.notFoundActivity) {
			throw new Error("NotFoundActivity already registered. You can only execute `<Application>.registerNotFoundActivity` once.")
		}

		this.notFoundActivity = activity
	}

	/** Sets a CSS variable on the root of the Application */
	public declareStyleProp(propertyName: string, value: string): void {
		this.$root.style.setProperty(propertyName, value)
	}

	/** Array of all the fixed components in this application. */
	private fixedComponents: HTMLElement[] = []

	/** Whether fixed components are currently marked as hidden or visible. */
	private fixedComponentsHidden = false

	/** Hides fixed components. */
	public hideFixedComponents(): void {
		if (this.fixedComponentsHidden) return
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.$root.style.setProperty("--activity-top", "0px")
		this.$root.style.setProperty("--activity-left", "0px")
		this.$root.style.setProperty("--activity-right", "0px")
		this.$root.style.setProperty("--activity-bottom", "0px")

		this.fixedComponents.forEach(($comp) => {
			$comp.style.opacity = "0"

			if ($comp.style.bottom === "0px") {
				$comp.style.transform = "translateY(100%)"
			} else if ($comp.style.top === "0px") {
				$comp.style.transform = "translateY(-100%)"
			} else if ($comp.style.left === "0px") {
				$comp.style.transform = "translateX(-100%)"
			} else if ($comp.style.right === "0px") {
				$comp.style.transform = "translateX(100%)"
			}
		})

		this.fixedComponentsHidden = true
		this.calculateActivitySize()
	}

	/** Calculates an activities size based on the sizes of fixed components. */
	private calculateActivitySize(): void {
		let left = 0
		let right = 0
		let top = 0
		let bottom = 0

		if (!this.fixedComponentsHidden) {
			for (let i = 0; i < this.fixedComponents.length; i++) {
				const element = this.fixedComponents[i]
				const anchor = element.dataset.anchor
				const rect = element.getBoundingClientRect()

				if (anchor === "left") left += rect.width
				else if (anchor === "right") right += rect.width
				else if (anchor === "bottom") bottom += rect.height
				else if (anchor === "top") top += rect.height
				else throw new Error("Unknown anchor for fixed component.")
			}
		}

		this.$root.style.setProperty("--activity-bottom", bottom + "px")
		this.$root.style.setProperty("--activity-top", top + "px")
		this.$root.style.setProperty("--activity-left", left + "px")
		this.$root.style.setProperty("--activity-right", right + "px")
	}

	/** Registers an element to keep either to the top/bottom/left/right of all activities. */
	public registerFixedComponent(anchor: "top" | "left" | "bottom" | "right", element: Component): void {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		element.classList.add("fixed-component")
		element.style.position = "fixed"
		element.style[anchor] = "0px"
		element.dataset.anchor = anchor
		this.fixedComponents.push(element)
		this.$root.appendChild(element)
		element.connectToAndWait(this.$root, undefined, true).then(() => {
			this.calculateActivitySize()
		})
	}

	/** Unregister all fixed components. */
	public unregisterFixedComponents() {
		for (let i = 0; i < this.fixedComponents.length; i++) {
			this.fixedComponents[i].remove() // disconnect
			this.fixedComponents.splice(i, 1) // remove from array
			this.calculateActivitySize()
		}
	}

	/** Unregister a fixed component either via a selector string or via the element reference. */
	public unregisterFixedComponent(element: string | HTMLElement, failSilently: boolean = false) {
		for (let i = 0; i < this.fixedComponents.length; i++) {
			let matched: boolean
			if (typeof element === "string") {
				matched = this.fixedComponents[i].matches(element)
			} else {
				matched = this.fixedComponents[i] === element
			}

			if (matched) {
				this.fixedComponents[i].remove() // disconnect
				this.fixedComponents.splice(i, 1) // remove from array
				this.calculateActivitySize() // re-calculate
				break
			}
		}

		if (!failSilently) {
			throw new Error("Could not find element to unregister: " + element)
		}
	}

	/** Shows all registered fixed components. */
	public showFixedComponents(): void {
		if (!this.fixedComponentsHidden) return
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.fixedComponents.forEach(($comp) => {
			$comp.style.opacity = ""
			$comp.style.transform = ""
		})

		this.fixedComponentsHidden = false
		this.calculateActivitySize()
	}

	/** Register a component to the Application. The component is automatically created based on it's class name unless `forceName` is defined.. */
	private registerComponent(component: Function, forceName?: string, failSilently?: true): string {
		// the find function below removes underscores (_) because in production classes are given _'s in their names based on their file location by Webpack
		const elementName = forceName || "component-" + toKebabCase(component.name.split("_").find((v, i, a) => i === a.length - 1) || component.name)
		if (customElements.get(elementName)) {
			if (failSilently) return elementName
			throw new Error(elementName + " is already defined in the custom elements registry.")
		} else {
			customElements.define(elementName, component)
			// console.log("Registered new component:", component.name, "→", elementName)
		}
		return elementName
	}

	/** Gets the current arguments of the page, everything after the `?` in the URL, but before the `#`, if that's anything at all. */
	public getPageArguments(): {[key: string]: string} {
		// Based on https://stackoverflow.com/questions/6539761/window-location-search-query-as-json

		return location.search
			.substring(1)
			.split("&")
			.reduce((result: {[key: string]: string}, value) => {
				const parts = value.split("=")

				if (parts[0]) {
					result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1])
				}

				return result
			}, {})
	}

	/** Returns the currently active activity */
	public getCurrentActivity(): Activity {
		const $active = this.$root.$$("" + this.currentActivityTag + ":not([destroyed])").reverse()[0]
		// console.log("Current activity from getCurrentActivity is", $active)
		if (!($active instanceof Activity)) throw new Error("Failed to get the current activity.")
		return $active
	}

	/** Returns the current hash arguments of the page. Everything after the `?` part in the `#` part. */
	private getHashArguments(): {[key: string]: string} {
		if (location.hash.indexOf("?") === -1) return {}
		return location.hash
			.substring(location.hash.indexOf("?") + 1)
			.split("&")
			.reduce((result, value) => {
				const parts = value.split("=")

				if (parts[0]) {
					result[decodeURIComponent(parts[0])] = JSON.parse(decodeURIComponent(parts[1]))
				}

				return result
			}, {})
	}

	/** The last URL hash value the was read by the browser. */
	private lastHash = ""

	public get hash() {
		return location.hash.split("?")[0].substr(1)
	}

	private destroyAllModals() {
		this.showFixedComponents()

		const all = this.getLoadedActivities()
		for (let i = 0; i < all.length; i++) {
			const existingModals = Array.from(all[i].$modalContainer.children)
			// console.warn("Deleting existing modals", this.getCurrentActivity(), existingModals)
			existingModals.forEach(($e) => {
				$e.setAttribute("destroyed", "")

				let aniStarted: boolean = false

				$e.addEventListener("animationstart", (ev) => {
					ev.stopImmediatePropagation()
					// console.log("Modal close animation started")
					aniStarted = true
					$e.addEventListener("animationend", () => {
						// console.log("Modal close animation finished")
						ev.stopImmediatePropagation()
						$e.remove()
					})
				})

				util.sleepFrames(2).then(() => {
					if (!aniStarted) {
						console.warn("No animation declared for destroying this component. Declare :host([destroyed]) { /* ... */ } in your components CSS to add an animation when this component is destroyed. [" + $e.tagName + "]")
						$e.remove()
					}
				})
			})
		}
	}

	/** Handles the hash being changed. */
	public hashChange(force?: true) {
		if (this.hash === this.lastHash && !force) return
		this.lastHash = this.hash

		if (this.getCurrentActivity().$modalContainer.querySelector(`[triggered-by-hash="${this.hash}"]`)) {
			console.warn("A modal that is triggered by this hash already exists, doing nothing.")
			return
		}

		this.destroyAllModals()

		if (this.hash) {
			const functionObject = this.getCurrentActivity().registeredModalHooks[this.hash]
			console.debug("Hash changed:", this.hash)

			if (functionObject) {
				if (typeof functionObject !== "function") throw new Error("Registered hash object is not a function.")

				// Activity.HideFixedComponents()

				const args = this.getHashArguments()
				const $modal = functionObject(args)
				if ($modal) {
					this.hideFixedComponents()
					$modal.setAttribute("triggered-by-hash", this.hash)
					$modal.type = "hash"
					this.getCurrentActivity().$modalContainer.appendChild($modal)
				} else {
					this.showFixedComponents()
					console.warn("Modal object was null, the hash handler probably couldn't create a valid object, so just created nothing instead.")
					if (Application.ThrowFatalOnNullModalObject) throw new Error("Couldn't create a modal object.")
				}
				// functionObject(Activity.ApplicationModalContainer, args)
			}
		} else {
			console.debug("Hash is empty.")
		}
	}

	public attachModal(modal: ModalComponent) {
		modal.type = "attached"
		this.hideFixedComponents()
		this.getCurrentActivity().$modalContainer.appendChild(modal)
	}

	private currentActivityStartedVia: "route" | "startActivityWithoutRouting" = "route"
	private currentActivityTag?: string
	private currentActivityArguments?: string

	/** Starts an activity by the component tag passed. Unlike in previous versions of greenframe this can only be called internally by the application, if you want to start an activity on a route, call `<Application>.goto(route)` or `<Application>.startActivityWithoutRouting()` */
	private startActivityViaTag(activityTag: string, noAnimation: boolean, args: {[key: string]: string}): Activity {
		this.currentActivityArguments = JSON.stringify(args)

		const setupActivity = (activity: Activity): Activity => {
			if (activity.activityTitle) {
				this.$title.innerText = `${activity.activityTitle} — ${this.applicationName}`
			} else {
				if (this.$title.innerText !== this.applicationName) {
					this.$title.innerText = this.applicationName
				}
			}

			activity.switchedTo(args)
			// this.hashChange()

			return activity
		}

		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		const $active = <Activity | null>this.$root.$_("" + activityTag + ":last-child:not([destroyed])")

		if ($active) {
			console.log("This activity is already active. Not starting it.")
			return setupActivity($active)
		} else {
			this.currentActivityTag = activityTag
			// check if the activity we already want exists
			const $loaded = <Activity | undefined>this.$root.$_(`${activityTag}:not([destroyed])`)
			if ($loaded) {
				console.log("The activity is already loaded. Bringing into view.")

				// get all the activities after the existing one
				let $next = $loaded.nextElementSibling
				while ($next) {
					if ($next instanceof Activity) {
						$next.destroy()
					}

					$next = $next.nextElementSibling
				}

				return setupActivity($loaded)
			} else {
				const $newActivity = document.createElement(activityTag)

				if ($newActivity instanceof Activity) {
					if (!noAnimation) {
						$newActivity.setAttribute("animate", "")
					}

					this.$root.appendChild($newActivity)
					return setupActivity($newActivity)
				} else {
					throw new Error("I tried to create a new activity, but `" + activityTag + "` doesn't appear to be an instance of Activity. This is probably a problem with one of your other components failing to register properly. See the log for more information.")
				}
			}
		}
	}

	/** Goes back to the previous activity if we were at one, otherwise goes to the default */
	public back() {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		if (this.navigated) {
			history.back()
		} else {
			const rh = this.generateRouteHistoryFromCurrentRoute()
			const prev = rh[rh.length - 2]
			if (prev) {
				this.goto(prev)
			} else {
				// Switch to the default activity if we didn't get here via a previous activity
				this.goto("/")
			}
		}
	}

	/** Returns all activities as an array. */
	private getLoadedActivities(): Activity[] {
		const $$nodes = this.$root.querySelectorAll("[activity]")
		const $$activities: Activity[] = []
		$$nodes.forEach(($node) => {
			if ($node instanceof Activity) {
				$$activities.push($node)
			} else {
				console.error($node, "has an activity attribute but seems to be an invalid activity.")
			}
		})
		return $$activities
	}

	/** Switch the activity by the route name selected. */
	public goto(route: string, data?: {[key: string]: string}) {
		let routeNameStripped: string = route[0] === "/" ? route.substr(1) : route

		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		let extra = ""

		if (data) {
			const keys = Object.keys(data)
			keys.forEach((key, n) => {
				extra += `${n === 0 ? "?" : "&"}${key}=${data[key]}`
			})
		}
		history.pushState({}, "", location.origin + "/" + routeNameStripped + extra)
		this.routeChanged(false)
	}

	private isPageArgumentsOutdated() {
		return this.currentActivityArguments !== JSON.stringify(this.getPageArguments())
	}

	/** Refreshes the current activity by firing `switchedTo` again or firing `refresh` if it exists. */
	public refreshCurrentActivity(): void {
		const current = this.getCurrentActivity()
		if (current.refresh) {
			current.refresh()
			console.warn("Refresh: fired refresh method.")
		} else if (this.isPageArgumentsOutdated()) {
			const args = this.getPageArguments()
			const str = JSON.stringify(args)
			// only fire switchedTo if the page arguments ACTUALLY changed
			if (str !== this.currentActivityArguments) {
				this.currentActivityArguments = str
				current.switchedTo(this.getPageArguments())
				console.warn("Refresh: fired switchedTo again.")
			}
		} else {
			console.warn("Refresh: did nothing.")
		}
	}

	/** Preload all resources under AssetLoader2.ResourcePreloadContainerTag */
	private preloadResources(): Promise<void> {
		return new Promise((resolve) => {
			const p = document.body.querySelector(AssetLoader2.ResourcePreloadContainerTag)
			if (!p) throw new Error(`Could not find "${AssetLoader2.ResourcePreloadContainerTag}" in the document body.`)
			const check = () => {
				const e = p.querySelector(`*[complete]`)
				if (!e) {
					resolve()
				} else {
					console.debug("Still waiting on", e)
				}
			}
			for (let i = 0; i < p.children.length; i++) {
				const c = p.children[i]
				if (c instanceof HTMLImageElement) {
					if (c.complete) {
						c.setAttribute("ready", "")
						// console.log("[LOADED/COMPLETE]", c.dataset.src)
					}
					c.addEventListener("load", () => {
						// console.log("[LOADED/LOAD]", c.dataset.src)
						c.setAttribute("ready", "")
						check()
					})
				} else {
					// svgs are...
					c.setAttribute("ready", "") // ...ready by default
				}
				check()
			}
		})
	}

	/** Whether the application has been started with `.start()` */
	private started: boolean = false

	/** Map of all registered routes./ */
	private routes: {[route: string]: () => Function} = {}

	/** When enabled if the user hits, for example, "/settings/login" then this option will start "/", "/settings" and "/settings/login". If it's disabled then just "/settings/login" will be loaded. */
	private static SELF_POPULATE_ROUTING_HISTORY = true

	private generateRouteHistoryFromCurrentRoute(): string[] {
		return location.pathname === "/" ? ["/"] : location.pathname.split("/").map((val, index, array) => array.slice(0, index).join("/") + "/" + val)
	}

	/** Starts the application */
	public async start(args: {routes: {[route: string]: () => Function}; componentDefinitions: Function[]}) {
		console.log("Waiting for resources...")
		await this.preloadResources()
		console.log("Resources ready!")

		this.started = true

		// Export the app to the window global
		window["app"] = this

		this.routes = args.routes

		// Attempt to register the colour schema
		try {
			this.setColorSchema(this.currentColorScheme)
		} catch (ex) {
			if (ex instanceof ColorSchemaDoesNotExistError) {
				console.warn("🌳🏗 ⚠️ You haven't specified any color schemes. You must register a dark and light color scheme. (That's why everything might look hotpink!)`")
			}
		}

		for (let i = 0; i < args.componentDefinitions.length; i++) {
			const component = args.componentDefinitions[i]
			this.registerComponent(component)
		}

		// Connect to the body of this window
		document.body.appendChild(this.$root)

		// Register hooks
		window.addEventListener("popstate", () => {
			this.routeChanged(false)
		})

		// Fire the initial route change
		if (Application.SELF_POPULATE_ROUTING_HISTORY) {
			const routes = this.generateRouteHistoryFromCurrentRoute()
			for (let i = 0; i < routes.length; i++) {
				this.routeChanged(true, routes[i])
			}
		} else {
			this.routeChanged(true)
		}

		const t = performance.now() - this.constructTime
		if (this.appSetup) this.appSetup(this.state)

		// Only fire the hashChange event after the current route has animated in; allows bounding boxes & sizes to be computed correctly and ensures no weird overlapping animations.
		const firstStartHash = (ev) => {
			ev.stopPropagation()
			// console.warn("*** $root animation end")
			this.hashChange()
			this.$root.removeEventListener("animationend", firstStartHash)
			this.calculateActivitySize()
		}
		this.$root.addEventListener("animationend", firstStartHash)

		console.info('Application "' + this.applicationName + '" in state "' + this.state + '" started in', t, "ms")
		if (t > 1500) {
			console.warn("Heads up! Your application took longer than 1.5 seconds to start. Your user may bail in this time. Consider the size of your assets, along with the number of complex components you are loading.")
		}
	}
}
