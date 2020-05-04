/** @format */

import {ComponentBase} from "./ComponentBase"
import Activity from "./Activity"
import {toKebabCase} from "./util"
import ModalComponent from "./ModalComponent"
import {ErrorActivity} from "./Activity"
import * as util from "./util"
import Component from "./Component"
import AssetLoader2 from "./AssetLoader2"
import {DOMUtil} from "."

/** The colour scheme for the component. This is a simple way to set CSS variables for different schemes. Greenframe will automatically decide what's best for the user. */
export type ColorSchemaName = "dark" | "light" | "highContrast"

export type ColorSchema = {[customProperty: string]: string}

/** An exception that is thrown when a color scheme the app tries to switch to does not exist. */
class ColorSchemaDoesNotExistError extends Error {}

/** The root of the application. This will attach to the body. */
class ApplicationRoot extends ComponentBase {
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
	private currentColorScheme: ColorSchemaName = Application.GetColorScheme()

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
	public static GetColorScheme(): ColorSchemaName {
		const useScheme = localStorage.getItem("greenframe-use-scheme")
		if (useScheme === "light" || useScheme === "dark" || useScheme === "highContrast") {
			console.log("Device colorscheme overriden by localStorage['greenframe-use-scheme'] =", useScheme)
			return useScheme
		} else {
			console.log("Detecting colorscheme via media query")
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
	}

	public registerColorScheme(name: ColorSchemaName | string, schema: ColorSchema) {
		this.registeredColorSchemas[name] = schema
		const $style = document.createElement("style")
		$style.setAttribute("color-schema", name)

		$style.innerHTML = this.$root.tagName + " {"
		for (let item in schema) {
			$style.innerHTML += "--schema-" + toKebabCase(item) + ": " + schema[item] + ";" + "\n"
		}
		$style.innerHTML += "}"
		// console.log("Created schema", $style)
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

		// Try to get the background color from the schema and apply it to "body" to fix visual bugs
		const schema = this.registeredColorSchemas[newSchema]
		if (schema && schema.applicationBackground) {
			document.body.style.backgroundColor = schema.applicationBackground
		} else {
			document.body.style.backgroundColor = newSchema === "dark" ? "black" : "white"
		}

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

		// if (this.currentActivityStartedVia === "route") this.routeChanged(false)
		// TODO: is this a suitable replacement?
		this.refreshCurrentActivity()

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
	private hideFixedComponents(): void {
		if (this.fixedComponentsHidden) {
			console.warn("Not hiding components, they are already hidden")
			return
		}
		// console.warn("Hiding fixed components.", this.fixedComponents)
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		console.warn("hideFixedComponents: current fixed components array:", this.fixedComponents)
		// set the style of all of the components to hidden
		this.fixedComponents.forEach(($comp) => {
			console.warn("Hiding component", $comp)
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
		console.log("Fixed components hidden. Calculating activity size.")
		this.calculateActivitySize()
	}

	private activitySizeCalculationPromises: Promise<DOMRect>[] = []

	/** Calculates an activities size based on the sizes of fixed components. Ensure fixed components have loaded correctly before calling this function. */
	private calculateActivitySize(): Promise<void> {
		return new Promise((resolve) => {
			let left = 0
			let right = 0
			let top = 0
			let bottom = 0

			if (!this.fixedComponentsHidden) {
				if (!this.activitySizeCalculationPromises.length) {
					// if this is empty, resolve immediately
					if (!this.fixedComponents.length) {
						console.log("calculateActivitySize: There are no fixed components right now, automatically resolving with 0px for all directions.")
						this.$root.style.setProperty("--activity-bottom", "0px")
						this.$root.style.setProperty("--activity-top", "0px")
						this.$root.style.setProperty("--activity-left", "0px")
						this.$root.style.setProperty("--activity-right", "0px")
						resolve()
						return
					}

					console.log("calculateActivitySize: I have fixed components but don't have calculation promises, creating them...")

					for (let i = 0; i < this.fixedComponents.length; i++) {
						const element = this.fixedComponents[i]
						const anchor = element.dataset.anchor
						const p = DOMUtil.WaitForDOMRect(element)

						p.then((rect) => {
							console.log("calculateActivitySize: Finished waiting for DOMRect of:", element)
							if (anchor === "left") left += rect.width
							else if (anchor === "right") right += rect.width
							else if (anchor === "bottom") bottom += rect.height
							else if (anchor === "top") top += rect.height
							else throw new Error("Unknown anchor for fixed component.")
						})

						this.activitySizeCalculationPromises.push(p)
					}
				} else {
					console.log("calculateActivitySize: activitySizeCalculationPromises already has items, so there must be a calculation already in progress. I won't do anything.")
					resolve()
					return
				}
			} else {
				console.log("calculateActivitySize: fixedComponentsHidden === true - automatically resolving with 0px for all directions.")
				this.$root.style.setProperty("--activity-bottom", "0px")
				this.$root.style.setProperty("--activity-top", "0px")
				this.$root.style.setProperty("--activity-left", "0px")
				this.$root.style.setProperty("--activity-right", "0px")
				resolve()
				return
			}

			Promise.all(this.activitySizeCalculationPromises).then((boxes) => {
				console.log("calculateActivitySize: I finished waiting for the sizes of the fixed components", boxes, {top, left, bottom, right})
				this.$root.style.setProperty("--activity-bottom", bottom + "px")
				this.$root.style.setProperty("--activity-top", top + "px")
				this.$root.style.setProperty("--activity-left", left + "px")
				this.$root.style.setProperty("--activity-right", right + "px")
				this.activitySizeCalculationPromises.splice(0, this.activitySizeCalculationPromises.length) // wipe array
				resolve()
			})
		})
	}

	/** Registers an element to keep either to the top/bottom/left/right of all activities. */
	public registerFixedComponent(anchor: "top" | "left" | "bottom" | "right", element: Component): void {
		console.log("Registering fixed component", element)
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
		console.log("Attempting to show fixed components")
		if (!this.fixedComponentsHidden) return
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.fixedComponents.forEach(($comp) => {
			$comp.style.opacity = ""
			$comp.style.transform = ""
		})

		this.fixedComponentsHidden = false
		console.log("Shown fixed components, recalculating activity size.")
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
			customElements.define(elementName, <CustomElementConstructor>component)
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

	/** Handles the hash being changed. */
	public hashChange(force?: true) {
		if (this.hash === this.lastHash && !force) return
		this.lastHash = this.hash

		if (this.getCurrentActivity().$modalContainer.querySelector(`[triggered-by-hash="${this.hash}"]`)) {
			console.warn("A modal that is triggered by this hash already exists, doing nothing except hiding fixed components.")
			this.hideFixedComponents()
			return
		}

		// Remove modals on the page
		this.getCurrentActivity().destroyAllModals()

		if (this.hash) {
			const functionObject = this.getCurrentActivity().registeredModalHooks[this.hash]
			console.warn("Firing hash change event for new hash:", this.hash)

			if (functionObject) {
				if (typeof functionObject !== "function") throw new Error("Registered hash object is not a function.")

				// Activity.HideFixedComponents()

				const args = this.getHashArguments()
				const $modal = functionObject(args)
				if ($modal) {
					// this.hideFixedComponents()

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
			this.showFixedComponents()
			console.debug("Hash is empty.")
		}
	}

	public attachModal(modal: ModalComponent) {
		modal.type = "attached"
		this.hideFixedComponents()
		this.getCurrentActivity().$modalContainer.appendChild(modal)
	}

	private currentActivityStartedVia: "route" | "startActivityWithoutRouting" | "routeOverride" = "route"
	private currentActivityTag?: string
	private currentActivityArguments?: string

	/** Starts an activity by the component tag passed. Unlike in previous versions of greenframe this can only be called internally by the application, if you want to start an activity on a route, call `<Application>.goto(route)` or `<Application>.startActivityWithoutRouting()` */
	private startActivityViaTag(activityTag: string, noAnimation: boolean, args: {[key: string]: string}): Activity {
		console.error("STARTING ACTIVITY!!", activityTag)
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
	public goto(route: string, data?: {[key: string]: string}, forceReplaceState?: boolean) {
		let routeNameStripped: string = route[0] === "/" ? route.substr(1) : route

		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		let extra = ""

		if (data) {
			const keys = Object.keys(data)
			keys.forEach((key, n) => {
				extra += `${n === 0 ? "?" : "&"}${key}=${data[key]}`
			})
		}

		if (forceReplaceState) {
			history.replaceState("GREENFRAME - goto [replace]", "", location.origin + "/" + routeNameStripped + extra)
		} else {
			history.pushState("GREENFRAME - goto", "", location.origin + "/" + routeNameStripped + extra)
		}

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
				if (this.currentActivityStartedVia === "route") {
					current.switchedTo(this.getPageArguments())
				} else {
					throw new Error("Implementation error: cannot refresh an activity that was not started via a route. Considering refactoring or updating this method.")
				}
				console.warn("Refresh: fired switchedTo again.")
			}
		} else {
			console.warn("Refresh: did nothing.")
		}
	}

	/** Preload all resources under AssetLoader2.ResourcePreloadContainerTag */
	private preloadResources(): Promise<void> {
		return new Promise((resolve) => {
			const p = AssetLoader2.root

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
					}
					c.addEventListener("load", () => {
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

	private navigationCounter = 0
	/** Handles the change of the current route */

	private routeChanged(initial: boolean) {
		const route = location.pathname
		console.warn("Detected route changed to:", route)

		if (!initial) this.navigated = true

		this.navigationCounter++

		const startActivity = (r: Function, b: "route" | "routeOverride") => {
			console.debug("Starting activity on route:", route)

			// Register the route if it's not registered
			this.currentlyConstructedActivity = r
			const activityTagName = this.registerComponent(r, undefined, true)

			this.startActivityViaTag(activityTagName, initial, this.getPageArguments())
			this.currentActivityStartedVia = b
			this.hashChange(true) // force this as the route changed, so hash stuff is out of date.
		}

		// refreshing stuff
		if (this.currentRoute === route && this.routes[route]() === this.currentlyConstructedActivity) {
			if (this.hash === this.lastHash) {
				console.warn("Refreshing the current activity as the router function specifies it should remain the same.")
				this.refreshCurrentActivity()
				return
			} else {
				console.warn("The activity didn't appear to change, just firing hashChange. hashChange() should only be firing once per navigation.")
				this.hashChange()
				return
			}
		}

		// Check the route overrides
		for (let i = 0; i < this.routeOverrides.length; i++) {
			const routeSplit = route.split("/")
			const routeOverride = this.routeOverrides[i]
			if (routeOverride.check(routeSplit)) {
				// get the activity
				const activity = routeOverride.execute()
				if (typeof activity === "string") {
					// re-route and replace this with the override
					//this.goto(activity, undefined, true)
					return
				} else if (typeof activity === "function") {
					const activityTagName = this.registerComponent(activity, undefined, true)
					this.currentActivityStartedVia = "routeOverride"
					this.currentlyConstructedActivity = activity
					this.startActivityViaTag(activityTagName, this.navigationCounter === 1, routeOverride.args ? routeOverride.args(routeSplit) : this.getPageArguments())
					this.hashChange(true) // force this as the route changed, so hash stuff is out of date.

					// bail out of the entire function as we've routed somewhere
					return
				}
			}
		}

		this.currentRoute = route

		if (this.routes[route]) {
			if (initial && Application.SELF_POPULATE_ROUTING_HISTORY) {
				const routeSplit = route.split("/")
				// for (let i = routeSplit.length - 1; i >= 0; i--) {
				for (let i = 0; i < routeSplit.length; i++) {
					const newRoute = routeSplit[i]
					console.error("Application.SELF_POPULATE_ROUTING_HISTORY", `"${newRoute}"`)
					startActivity(this.routes[route](), "route")
				}
			} else {
				startActivity(this.routes[route](), "route")
			}
		} else if (this.notFoundActivity) {
			startActivity(this.notFoundActivity, "route")
		} else {
			throw new Error("No activity exists at this route, and there is no handler for 404's.")
		}
	}

	/** Application route overrides. These will be check if the user navigates somewhere using the `check` item, if this returns `true`, the `execute` function will be fired to get the Activity to use, along the `args` function to get the arguments to be used when starting that function. */
	private routeOverrides: {check: (path: string[]) => boolean; execute: () => Function | string; args?: (path: string[]) => {[key: string]: string}}[] = []

	/** Adds a route override */
	public addRouteOverride(check: (path: string[]) => boolean, execute: () => Function | string, args?: (path: string[]) => {[key: string]: string}) {
		this.routeOverrides.push({check, execute, args})
	}

	public generateRouteHistoryFromCurrentRoute(): string[] {
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

		const t = performance.now() - this.constructTime

		// Only fire the hashChange event after the current route has animated in; allows bounding boxes & sizes to be computed correctly and ensures no weird overlapping animations.
		const postApplicationStart = async (ev) => {
			console.warn("Root animation ended. Doing hashChange and calculating the activity size...")
			ev.stopPropagation()
			await this.calculateActivitySize()

			// Fire the initial route change
			this.routeChanged(true)

			this.$root.removeEventListener("animationend", postApplicationStart)
			if (this.appSetup) this.appSetup(this.state)
		}
		this.$root.addEventListener("animationend", postApplicationStart)

		console.info('Application "' + this.applicationName + '" in state "' + this.state + '" started in', t, "ms")
		if (t > 1500) {
			console.warn("Heads up! Your application took longer than 1.5 seconds to start. Your user may bail in this time. Consider the size of your assets, along with the number of complex components you are loading.")
		}
	}
}
