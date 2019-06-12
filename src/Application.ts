/** @format */

import Component from "./Component"
import Activity from "./Activity"
import {toKebabCase} from "./util"

/** The colour scheme for the component. This is a simple way to set CSS variables for different schemes. Greenframe will automatically decide what's best for the user. */
type ColorSchemaName = "dark" | "light" | "highContrast"

type ColorSchema = {
	text: string
	applicationBackground: string
	[customProperty: string]: string
}

/** An exception that is thrown when a color scheme the app tries to switch to does not exist. */
class ColorSchemaDoesNotExistError extends Error {}

/** The root of the application. This will attach to the body. */
class ApplicationRoot extends Component {
	constructor() {
		super(
			`
				<div id="modal-container"></div>
			`,
			`
				/* Default activity variables */
				component-application-root {
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

					background: var(--schema-application-background);
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
			`,
			// Do not isolate the root, this will allow us to use external scripts that require direct access to the document root, such as SSO.
			false
		)
	}

	public setup(): void {
		// We don't need to do any setup here.
	}
}

/**
 * Application.ts holds application related functions. It splits the Activity namespace up, so that the activity is free to do only activity things. Only one application may exist per window.
 */
export default class Application {
	/** Reference to the root object of the application. */
	public $root: ApplicationRoot

	/** Reference to the modal container. */
	public $modalContainer: HTMLElement

	/** Reference to the current title element. */
	public $title: HTMLTitleElement

	/** Time this was created. */
	private constructTime: number

	/** The current colour scheme of the application. */
	private currentColorScheme: ColorSchemaName = Application.GetDefaultColorScheme()

	private registeredColorSchemas: {[key in ColorSchemaName]?: HTMLStyleElement} = {}

	private static GetDefaultColorScheme(): ColorSchemaName {
		const useScheme = localStorage.getItem("greenframe-use-scheme")
		if (useScheme === "light" || useScheme === "dark" || useScheme === "highContrast") {
			return useScheme
		} else {
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
	}

	public registerColorScheme(name: ColorSchemaName, schema: ColorSchema) {
		const $style = document.createElement("style")
		$style.setAttribute("color-schema", "")
		$style.innerHTML = "component-application-root {"
		for (let item in schema) {
			$style.innerHTML += "--schema-" + toKebabCase(item) + ": " + schema[item] + ";" + "\n"
		}
		$style.innerHTML += "}"
		console.log("Created schema", $style)
		this.registeredColorSchemas[name] = $style
	}

	/**
	 * Sets up a new color schema to use for the application.
	 *
	 * @throws ColorSchemaDoesNotExistError
	 **/
	public setColorSchema(newSchema: ColorSchemaName, remember?: boolean) {
		// Check the colour scheme exists
		const $schema = this.registeredColorSchemas[newSchema]
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

	constructor(public readonly applicationName, public readonly rootRoute = "") {
		this.constructTime = performance.now()

		this.registerComponent(ApplicationRoot)
		this.$root = new ApplicationRoot()
		// Create ref to the modal container
		this.$modalContainer = this.$root.$("#modal-container")

		// Create title if none exists
		if (!document.head.querySelector("title")) {
			const $newTitle = document.createElement("title")
			document.head.appendChild($newTitle)
		}

		// Setup the title of the window
		this.$title = <HTMLTitleElement>document.head.querySelector("title")
	}

	/** Map of the registered activities via route name. Value is the string of the defined custom element. */
	public registeredActivities: {[routeName: string]: string} = {}

	/** Returns whether the application is in PWA "standalone" mode as as a boolean. */
	public isAppInstalled(): boolean {
		return window.matchMedia("(display-mode: standalone)").matches
	}

	private lastRoute: string = ""

	/** Handles the change of the current route. */
	private async routeChanged(animate: boolean) {
		const thisRoute = this.getCurrentActivityAsRoute()
		if (this.lastRoute === thisRoute) return

		this.lastRoute = thisRoute

		console.debug("Route changed:", thisRoute)

		const switchTo = async (activity: Activity) => {
			if (activity.activityTitle) {
				this.$title.innerText = this.buildTitle()
			} else {
				if (this.$title.innerText !== this.applicationName) {
					this.$title.innerText = this.applicationName
				}
			}

			if (!activity.isActivity) {
				console.error(activity)
				throw new Error("switchTo() fired with an activity which isn't of type Activity. This is probably due to a fault in your activity, check the log for other errors.")
			}

			await activity.switchedTo(this.getPageArguments())
		}

		// Try to start the activity in the route
		const keys = Object.keys(this.registeredActivities)
		for (let i = 0; i < keys.length; i++) {
			const targetRoute = keys[i]

			if (thisRoute === targetRoute) {
				const $a = this.startActivity(this.registeredActivities[thisRoute], !animate)
				$a.removeAttribute("target-not-found")
				await switchTo($a)
				return
			}
		}

		// TODO: Define a handler for 404's
		throw new Error("No activity exists at this route, and there is no handler for 404's.")
	}

	/** Sets a  */
	public declareStyleProp(propertyName: string, value: string): void {
		this.$root.style.setProperty(propertyName, value)
	}

	public getCurrentActivityAsRoute(): string {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		return (
			"/" +
			this.rootRoute +
			location.pathname
				.substr(1)
				.split("/")
				[this.rootRoute.split("/").length - 1].trim()
		)
	}

	/** Array of all the fixed components in this application. */
	private fixedComponents: HTMLElement[] = []

	/** Hides fixed components. */
	public hideFixedComponents(): void {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.updateFixedComponentPositions = false

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

	/** Whether to update fixed components positions or not using RAF. */
	private updateFixedComponentPositions = true

	/** Shows all registered fixed components. */
	public showFixedComponents(): void {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.updateFixedComponentPositions = true
		this.fixedComponents.forEach(($comp) => {
			$comp.style.transform = ""
		})
	}

	/** Register a component to the Application. The component is automatically created based on it's class name. */
	private registerComponent(component: Function, dieIfRegistered: boolean = false, forceName?: string): void {
		const elementName = forceName || "component-" + toKebabCase(component.name)
		if (customElements.get(elementName)) {
			const message = elementName + " is already defined in the custom elements registry."
			if (dieIfRegistered) {
				throw new Error(message)
			} else {
				console.warn(message)
			}
		} else {
			customElements.define(elementName, component)
			console.log("Registered new component:", component.name, "→", elementName)
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
	private getCurrentActivity(): Activity {
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
					result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1])
				}

				return result
			}, {})
	}

	private lastHash = ""

	/** Handles the hash being changed. */
	private hashChanged() {
		const hash = location.hash.split("?")[0].substr(1)
		if (hash === this.lastHash) return
		this.lastHash = hash

		// delete existing modals
		Array.from(this.$modalContainer.children).forEach(($e) => {
			$e.addEventListener("animationend", () => {
				$e.remove()
			})

			$e.setAttribute("destroyed", "")
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
				this.$modalContainer.appendChild($modal)
				// functionObject(Activity.ApplicationModalContainer, args)
			}
		} else {
			console.debug("Hash is empty.")
		}
	}

	/** Starts an activity by the component tag passed. */
	public startActivity(activityTag: string, dontAnimate?: boolean): Activity {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		const $active = <Activity | null>this.$root.$_("" + activityTag + ":last-child:not([destroyed])")

		if ($active) {
			console.warn("This activity is already active. Not starting it.")
			return $active
		} else {
			// check if the activity we already want exists
			const $loaded = <Activity>this.$root.$_(`${activityTag}:not([destroyed])`)
			if ($loaded) {
				console.log("The activity is already loaded. Bringing into view.")

				// get all the activities after the existing one
				let $next = $loaded.nextElementSibling
				while ($next) {
					if ($next.hasAttribute("activity")) {
						;(<Activity>$next).destroy()
						console.log("Destroying", $next)
					}

					$next = $next.nextElementSibling
				}
				return $loaded
			} else {
				const $newActivity = document.createElement(activityTag)

				if ($newActivity instanceof Activity) {
					if (!dontAnimate) {
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

		if (history.state) {
			history.back()
		} else {
			// Switch to the default activity if we didn't get here via a previous activity
			this.switchToMainActivity()
		}
	}

	/** Switch back to the main activity.*/
	public switchToMainActivity() {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.switchActivityViaRouteName("")
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
	public switchActivityViaRouteName(routeNameWithSlash: string, data?: {[key: string]: string}) {
		let routeName: string = routeNameWithSlash[0] === "/" ? routeNameWithSlash.substr(1) : routeNameWithSlash

		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		let extra = ""

		if (data) {
			const keys = Object.keys(data)
			keys.forEach((key, n) => {
				extra += `${n === 0 ? "?" : "&"}${key}=${data[key]}`
			})
		}

		history.pushState({}, this.buildTitle(), location.origin + "/" + this.rootRoute + routeName + extra)
		this.routeChanged(true)
	}

	/** Builds a title string for use in activity switching */
	private buildTitle(): string {
		return `${this.getCurrentActivity().activityTitle} | ${this.applicationName}`
	}

	/** Registers the activity for use by the framework. */
	private registerActivity(route: string, activity: Function): string {
		if (route[0] !== "/") throw new Error("Missing / from route.")

		const fullRoute = this.rootRoute + route

		if (!activity.prototype.switchedTo) {
			throw new Error("Cannot register this activity as it's not a valid activity class. Ensure it inherits from the `Activity` class, and that it contains the required `switchedTo` method.")
		}

		if (this.registeredActivities[fullRoute]) {
			throw new Error("Route `" + route + "` already registered.")
		}

		const elementName =
			"activity" +
			route
				.split("")
				.map((char, i, all) => {
					return char === "/" ? "-slash" + (i === all.length - 1 ? "" : "-") : char
				})
				.join("")

		// const elementName = "activity" + route.split("/").join("-slash")

		// Register the component
		this.registerComponent(activity, false, elementName)

		// Define as an activity
		this.registeredActivities[fullRoute] = elementName
		return route
	}

	/** A readonly copy of `location.pathname` */
	public readonly entryPoint: string = location.pathname

	/** Whether the application has been started with `.start()` */
	private started: boolean = false

	/** Starts the application */
	public start(args: {activityDefinitions: {[route: string]: Function}; componentDefinitions: Function[]}) {
		this.started = true

		// Attempt to register the colour schema
		try {
			this.setColorSchema(this.currentColorScheme)
		} catch (ex) {
			if (ex instanceof ColorSchemaDoesNotExistError) {
				console.warn("🌳🏗 ⚠️ You haven't specified any color schemes. Consider doing so for dark mode support with `app.registerColorScheme()`")
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

		// Register hooks
		window.addEventListener("popstate", () => {
			this.routeChanged(true)
			this.hashChanged()
		})

		this.routeChanged(false)
		this.hashChanged()

		const t = performance.now() - this.constructTime
		console.info("Application `" + this.applicationName + "` started in", t, "ms")
		if (t > 1500) {
			console.warn("Heads up! Your application took longer than 1.5 seconds to start. Your user may bail in this time. Consider the size of your assets, along with the number of complex components you are loading.")
		}
	}
}
