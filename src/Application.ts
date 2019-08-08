/** @format */

import ComponentCore from "./ComponentCore"
import Activity from "./Activity"
import {toKebabCase} from "./util"
import {ModalComponent, ErrorActivity, util} from "./index"

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
		this.html(`<div id="modal-container"></div>`)
		this.css(`
			/* Default activity variables */
			:host {
				--activity-top: 0px;
				--activity-left: 0px;
				--activity-bottom: 0px;
				--activity-right: 0px;
				--animation-time: 0.3s;

				animation: fadeIn 0.15s;
				animation-fill-mode: both;

				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
			}

			#modal-container {
				z-index: 2;
				position: fixed;
				overflow: visible;
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

	/** Reference to the modal container. */
	public get $modalContainer(): HTMLElement {
		return this.$root.$("#modal-container")
	}

	/** Reference to the current title element. */
	public $title: HTMLTitleElement

	/** Time this was created. */
	private constructTime: number

	/** The current color scheme of the application. */
	private currentColorScheme: ColorSchemaName = Application.GetDefaultColorScheme()

	/** Registered color schemes as stylesheet elements. */
	private registeredColorSchemaStylesheets: {[key in ColorSchemaName]?: HTMLStyleElement} = {}

	private registeredColorSchemas: {[key in ColorSchemaName]?: ColorSchema} = {}

	/** Container for icons. */
	public icons: {[iconName: string]: () => SVGElement} = {}

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

	public currentAppState: string = this.defaultState

	/** Switches the app state. This will remove all fixed components and re-fire the app setup. */
	public switchAppState(newState: string) {
		this.unregisterFixedComponents()
		this.currentAppState = newState
		// because we've switched the app state we should also re-fire the current activities switchedTo prop
		this.getCurrentActivity().switchedTo(this.getPageArguments())
		if (this.appSetup) this.appSetup(newState)
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

	/** Map of the registered activities via route name. Value is the string of the defined custom element. */
	public registeredActivities: {[routeName: string]: string} = {}

	/** Returns whether the application is in PWA "standalone" mode as as a boolean. */
	public isAppInstalled(): boolean {
		return window.matchMedia("(display-mode: standalone)").matches
	}

	/** The currently active route. */
	private currentRoute: string = ""

	/** Returns whether the specified activity is currently active */
	public isActivityActive(test: Activity) {
		return test.tagName.toLowerCase() === this.registeredActivities[this.getCurrentActivityAsRoute()]
	}

	/** Whether the user has navigated since the page has loaded. */
	private navigated: boolean = false

	/** Handles the change of the current route. */
	private routeChanged(initial: boolean) {
		if (!initial) this.navigated = true
		const route = this.getCurrentActivityAsRoute()

		if (this.currentRoute === route) {
			const current = this.getCurrentActivity()
			if (current.refresh) {
				current.refresh()
			}
			return
		}

		this.currentRoute = route

		console.debug("Route changed to:", route)

		// Try to start the activity in the route
		const activityTagName = this.registeredActivities[route]

		if (!activityTagName) {
			if (this.notFoundActivityRegistered) {
				this.startActivity(Application.NotFoundActivityTagName, !!initial)
			} else {
				// TODO: Define a handler for 404's
				throw new Error("No activity exists at this route, and there is no handler for 404's.")
			}
		}

		const activity = this.startActivity(activityTagName, !!initial)

		// Show/hide fixed components
		if (typeof activity.fixedComponentVisibility === "boolean") {
			if (activity.fixedComponentVisibility === true) {
				this.showFixedComponents()
			} else {
				this.hideFixedComponents()
			}
		}

		activity.switchedTo(this.getPageArguments())

		if (activity.activityTitle) {
			this.$title.innerText = `${activity.activityTitle} — ${this.applicationName}`
		} else {
			if (this.$title.innerText !== this.applicationName) {
				this.$title.innerText = this.applicationName
			}
		}

		if (!activity.isActivity) {
			console.error(activity)
			throw new Error("routeChanged() fired with an activity which isn't of type Activity. This is probably due to a fault in your activity, check the log for other errors.")
		}

		return
	}

	private static ErrorActivityTagName = "activity-error"
	// private errorActivityClass?: Function
	public registerErrorActivity(activityClass: Function) {
		// if (this.errorActivityClass) {
		// throw new Error("`registerErrorActivity` can only be called once.")
		// }

		// this.errorActivityClass = activity

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

	private static NotFoundActivityTagName = "activity-not-found"
	private notFoundActivityRegistered: boolean = false
	public registerNotFoundActivity(activity: Function) {
		if (this.notFoundActivityRegistered) {
			throw new Error("NotFoundActivity already registered. You can only execute `<Application>.registerNotFoundActivity` once.")
		}

		this.notFoundActivityRegistered = true

		// Register the component
		this.registerComponent(activity, Application.NotFoundActivityTagName)
	}

	/** Sets a CSS variable on the root of the Application */
	public declareStyleProp(propertyName: string, value: string): void {
		this.$root.style.setProperty(propertyName, value)
	}

	/** Returns the current activity as the route it's registered under. */
	public getCurrentActivityAsRoute(): string {
		return location.pathname
	}

	/** Array of all the fixed components in this application. */
	private fixedComponents: HTMLElement[] = []

	/** Hides fixed components. */
	public hideFixedComponents(): void {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.updateFixedComponentPositions = false

		requestAnimationFrame(() => {
			this.$root.style.setProperty("--activity-top", "0px")
			this.$root.style.setProperty("--activity-left", "0px")
			this.$root.style.setProperty("--activity-right", "0px")
			this.$root.style.setProperty("--activity-bottom", "0px")

			this.fixedComponents.forEach(($comp) => {
				if ($comp.style.bottom === "0px") {
					$comp.style.transform = "translateY(100%)"
				}

				if ($comp.style.top === "0px") {
					$comp.style.transform = "translateY(-100%)"
				}

				if ($comp.style.top === "0px") {
					$comp.style.transform = "translateY(-100%)"
				}

				if ($comp.style.left === "0px") {
					$comp.style.transform = "translateX(-100%)"
				}

				if ($comp.style.right === "0px") {
					$comp.style.transform = "translateX(100%)"
				}
			})
		})
	}

	/** Registers an element to keep either to the top/bottom/left/right of all activities. */
	public registerFixedComponent(anchor: "top" | "left" | "bottom" | "right", element: HTMLElement): void {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		element.classList.add("fixed-component")
		element.style.position = "fixed"
		element.style[anchor] = "0px"
		this.fixedComponents.push(element)
		this.$root.appendChild(element)

		let cached: number = 0
		const keepPositionValid = () => {
			if (this.updateFixedComponentPositions) {
				const rect = element.getBoundingClientRect()

				let value: number
				if (anchor === "left" || anchor === "right") {
					value = rect.width
				} else {
					value = rect.height
				}

				if (cached !== value) {
					cached = value
					this.$root.style.setProperty("--activity-" + anchor, value + "px")
				}
			}

			requestAnimationFrame(keepPositionValid)
		}
		requestAnimationFrame(keepPositionValid)
	}

	/** Unregister all fixed components. */
	public unregisterFixedComponents() {
		for (let i = 0; i < this.fixedComponents.length; i++) {
			this.fixedComponents[i].remove() // disconnect
			this.fixedComponents.splice(i, 1) // remove from array
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
				break
			}
		}

		if (!failSilently) {
			throw new Error("Could not find element to unregister: " + element)
		}
	}

	/** Whether to update fixed components positions or not using RAF. */
	private updateFixedComponentPositions = true

	/** Shows all registered fixed components. */
	public showFixedComponents(): void {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.updateFixedComponentPositions = true
		requestAnimationFrame(() => {
			this.fixedComponents.forEach(($comp) => {
				$comp.style.transform = ""
			})
		})
	}

	/** Register a component to the Application. The component is automatically created based on it's class name unless `forceName` is defined.. */
	private registerComponent(component: Function, forceName?: string): void {
		// the find function below removes underscores (_) because in production classes are given _'s in their names based on their file location
		const elementName = forceName || "component-" + toKebabCase(component.name.split("_").find((v, i, a) => i === a.length - 1) || component.name)
		if (customElements.get(elementName)) {
			throw new Error(elementName + " is already defined in the custom elements registry.")
		} else {
			customElements.define(elementName, component)
			console.log("Registered new component:", component.name, "→", elementName, process.env.NODE_ENV == "production" ? "(I am running in production mode, so my component names are not as verbose, switch to development mode for component names to reflect class names)" : "")
		}
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
		const $$a = this.getLoadedActivities()
		return $$a[$$a.length - 1]
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

	/** Handles the hash being changed. */
	public hashChange() {
		const hash = location.hash.split("?")[0].substr(1)
		if (hash === this.lastHash) return
		this.lastHash = hash
		// console.log("--hash change --", hash)

		// delete existing modals
		Array.from(this.$modalContainer.children).forEach(($e) => {
			$e.setAttribute("destroyed", "")

			let aniStarted: boolean = false

			$e.addEventListener("animationstart", () => {
				aniStarted = true
				$e.addEventListener("animationend", () => {
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

		// Activity.ShowFixedComponents()

		if (hash) {
			const functionObject = this.getCurrentActivity().registeredModalHooks[hash]
			console.debug("Hash changed:", hash)

			if (functionObject) {
				if (typeof functionObject !== "function") throw new Error("Registered hash object is not a function.")

				// Activity.HideFixedComponents()

				const args = this.getHashArguments()
				const $modal = functionObject(args)
				if ($modal) {
					$modal.type = "hash"
					this.$modalContainer.appendChild($modal)
				} else {
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
		this.$modalContainer.appendChild(modal)
	}

	/** Starts an activity by the component tag passed. Unlike in previous versions of greenframe this can only be called internally by the application, if you want to start an activity on a route, call `<Application>.goto(route)` */
	private startActivity(activityTag: string, noAnimation?: boolean): Activity {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		const $active = <Activity | null>this.$root.$_("" + activityTag + ":last-child:not([destroyed])")

		if ($active) {
			console.log("This activity is already active. Not starting it.")
			return $active
		} else {
			// check if the activity we already want exists
			const $loaded = <Activity | undefined>this.$root.$_(`${activityTag}:not([destroyed])`)
			if ($loaded) {
				console.log("The activity is already loaded. Bringing into view.")

				// get all the activities after the existing one
				let $next = $loaded.nextElementSibling
				while ($next) {
					if ($next instanceof Activity) {
						$next.destroy()
						console.log("Destroying", $next)
					}

					$next = $next.nextElementSibling
				}

				return $loaded
			} else {
				const $newActivity = document.createElement(activityTag)

				if ($newActivity instanceof Activity) {
					if (!noAnimation) {
						$newActivity.setAttribute("animate", "")
					}

					this.$root.appendChild($newActivity)
					return $newActivity
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
			// Switch to the default activity if we didn't get here via a previous activity
			this.switchToMainActivity()
		}
	}

	/** Switch back to the main activity. @deprecated use `<Application>.goto("/")` instead. */
	public switchToMainActivity() {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.goto("/")
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
	public goto(route: string, data?: {[key: string]: string}, replaceState?: boolean) {
		let routeNameStripped: string = route[0] === "/" ? route.substr(1) : route

		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		let extra = ""

		if (data) {
			const keys = Object.keys(data)
			keys.forEach((key, n) => {
				extra += `${n === 0 ? "?" : "&"}${key}=${data[key]}`
			})
		}
		history[replaceState ? "replaceState" : "pushState"]({}, "", location.origin + "/" + routeNameStripped + extra)
		this.routeChanged(false)
	}

	private static GenerateActivityName(route: string): string {
		return (
			"activity" +
			route
				.split("")
				.map((char, i, all) => (char === "/" ? "-slash" + (i === all.length - 1 ? "" : "-") : char))
				.join("")
		)
	}

	/** Registers the activity for use by the framework. */
	private registerActivity(route: string, activity: Function): string {
		if (route[0] !== "/") throw new Error("Missing / from route.")

		if (!activity.prototype.switchedTo) {
			throw new Error("Cannot register this activity as it's not a valid activity class. Ensure it inherits from the `Activity` class, and that it contains the required `switchedTo` method.")
		}

		if (this.registeredActivities[route]) {
			throw new Error("Route `" + route + "` already registered.")
		}

		const elementName = Application.GenerateActivityName(route)

		// Register the component
		this.registerComponent(activity, elementName)

		// Define as an activity
		this.registeredActivities[route] = elementName

		return route
	}

	/** Refreshes the current activity by firing `switchedTo` again or firing `refresh` if it exists. */
	public refreshCurrentActivity(): void {
		const current = this.getCurrentActivity()
		if (current.refresh) {
			current.refresh()
		} else {
			current.switchedTo(this.getPageArguments())
		}
	}

	/** Whether the application has been started with `.start()` */
	private started: boolean = false

	/** Starts the application */
	public start(args: {activityDefinitions: {[route: string]: Function}; componentDefinitions: Function[]}) {
		this.started = true

		// Export the app to the window global
		window["app"] = this

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

		for (let i = 0; i < Object.keys(args.activityDefinitions).length; i++) {
			const route = Object.keys(args.activityDefinitions)[i]
			this.registerActivity(route, args.activityDefinitions[route])
		}

		// Connect to the body of this window
		document.body.appendChild(this.$root)

		// Start the root activity
		const rootActivity = this.registeredActivities["/"]
		if (rootActivity) {
			this.startActivity(this.registeredActivities["/"], true)
		} else {
			throw new Error("Please define an activity class at root ('/') -- read the docs")
		}

		// Register hooks
		window.addEventListener("popstate", () => {
			this.routeChanged(false)
		})

		window.addEventListener("hashchange", () => {
			this.hashChange()
		})

		this.routeChanged(true)
		this.hashChange()

		const t = performance.now() - this.constructTime
		if (this.appSetup) this.appSetup(this.currentAppState)

		console.info('Application "' + this.applicationName + '" in state "' + this.currentAppState + '" started in', t, "ms")
		if (t > 1500) {
			console.warn("Heads up! Your application took longer than 1.5 seconds to start. Your user may bail in this time. Consider the size of your assets, along with the number of complex components you are loading.")
		}
	}
}
