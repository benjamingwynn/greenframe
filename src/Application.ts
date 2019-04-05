/** @format */

import Component from "./Component"
import Activity from "./Activity"
import {toKebabCase} from "./util"

// globals like `window` and `document` are undefined here, use `this.<global>` instead, inside of the Application instance.
const window = undefined
const document = undefined
const setTimeout = undefined
const setInterval = undefined
const location = undefined
const customElements = undefined
const history = undefined

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

					background: white;
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

	constructor(public readonly applicationName, public readonly window: Window, public readonly rootRoute = "") {
		this.constructTime = performance.now()

		this.registerComponent(ApplicationRoot)
		this.$root = new ApplicationRoot()
		// Create ref to the modal container
		this.$modalContainer = this.$root.$("#modal-container")

		// Create title if none exists
		if (!this.document.head.querySelector("title")) {
			const $newTitle = this.document.createElement("title")
			this.document.head.appendChild($newTitle)
		}

		// Setup the title of the window
		this.$title = <HTMLTitleElement>this.document.head.querySelector("title")
	}

	public document = this.window.document
	public setTimeout = this.window.setTimeout
	public setInterval = this.window.setInterval
	public location = this.window.location
	public customElements = this.window.customElements
	public history = this.window.history

	/** Map of the registered activities via route name. Value is the string of the defined custom element. */
	public registeredActivities: {[routeName: string]: string} = {}

	/** Returns whether the application is in PWA "standalone" mode as as a boolean. */
	public isAppInstalled(): boolean {
		return this.window.matchMedia("(display-mode: standalone)").matches
	}

	/** Handles the change of the current route. */
	private async routeChanged(animate: boolean) {
		const thisRoute = this.getCurrentActivityAsRoute()

		const switchTo = async (activity: Activity) => {
			if (activity.title) {
				this.$title.innerText = this.buildTitle()
			} else {
				if (this.$title.innerText !== this.applicationName) {
					this.$title.innerText = this.applicationName
				}
			}

			if (!activity.shadowRoot) throw new Error("Missing shadowRoot for routed activity.")

			await activity.switchedTo(this.getPageArguments())
		}

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

		// Start default instead
		if (Application.DefaultActivityTag) {
			const $target = this.startActivity(Application.DefaultActivityTag, true)
			$target.setAttribute("target-not-found", "")
			await switchTo($target)
		} else {
			throw new Error("No default route provided, and an invalid route was passed.")
		}
	}

	/** Sets a  */
	public declareStyleProp(propertyName: string, value: string): void {
		this.$root.style.setProperty(propertyName, value)
	}

	public getCurrentActivityAsRoute(): string {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		return (
			this.rootRoute +
			this.location.pathname
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
	private registerComponent(component: Function, dieIfRegistered: boolean = false): void {
		const elementName = "component-" + toKebabCase(component.name)
		console.log(elementName, component.prototype)
		if (this.customElements.get(elementName)) {
			const message = elementName + " is already defined in the custom elements registry."
			if (dieIfRegistered) {
				throw new Error(message)
			} else {
				console.warn(message)
			}
		} else {
			this.customElements.define("component-" + elementName, component)
			console.log("Registered new component:", component.name, "→", elementName)
		}
	}

	/** Gets the current arguments of the page, everything after the `?` in the URL, but before the `#`, if that's anything at all. */
	public getPageArguments(): {[key: string]: string} {
		// Based on https://stackoverflow.com/questions/6539761/window-location-search-query-as-json

		return this.location.search
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
		if (this.location.hash.indexOf("?") === -1) return {}
		return this.location.hash
			.substring(this.location.hash.indexOf("?") + 1)
			.split("&")
			.reduce((result, value) => {
				const parts = value.split("=")

				if (parts[0]) {
					result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1])
				}

				return result
			}, {})
	}

	/** Handles the hash being changed. */
	private hashChanged() {
		// delete existing modals
		Array.from(this.$modalContainer.children).forEach(($e) => {
			$e.addEventListener("animationend", () => {
				$e.remove()
			})

			$e.setAttribute("destroyed", "")
		})

		// Activity.ShowFixedComponents()

		const hash = this.location.hash.split("?")[0].substr(1)

		if (hash) {
			const functionObject = this.getCurrentActivity().registeredModalHooks[hash]
			console.log("Hash changed:", hash, functionObject)

			if (functionObject) {
				if (typeof functionObject !== "function") throw new Error("Registered hash object is not a function.")

				// Activity.HideFixedComponents()

				const args = this.getHashArguments()
				const $modal = functionObject(args)
				this.$modalContainer.appendChild($modal)
				// functionObject(Activity.ApplicationModalContainer, args)
			}
		} else {
			console.log("Hash is empty.")
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
				const $newActivity = <Activity>this.document.createElement(activityTag)

				if (!dontAnimate) {
					$newActivity.setAttribute("animate", "")
				}

				// for (let componentIndex = 0; componentIndex < $newActivity.components.length; componentIndex++) {
				// 	const componentRef = $newActivity.components[componentIndex]
				// 	this.registerComponent(componentRef)
				// }

				this.$root.appendChild($newActivity)
				return $newActivity
			}
		}
	}

	/** Goes back to the previous activity if we were at one, otherwise goes to the default */
	public back() {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		if (this.history.state) {
			this.history.back()
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

	/** Get the default registered activity. */
	public getDefaultActivity(): Activity {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		if (Application.DefaultActivityTag) {
			return <Activity>this.$root.querySelector(Application.DefaultActivityTag)
		} else {
			throw new Error("No default activity provided")
		}
	}

	/** Holds the last activity route name */
	private lastRoute = this.location.pathname.substr(1)

	/** Switch the activity by the route name selected. */
	public switchActivityViaRouteName(routeName: string, data?: {[key: string]: string}) {
		if (!this.started) throw new Error("Application hasn't started yet. Call `Application.start()` first.")

		this.lastRoute = this.location.pathname.substr(1)

		let extra = ""

		if (data) {
			const keys = Object.keys(data)
			keys.forEach((key, n) => {
				extra += `${n === 0 ? "?" : "&"}${key}=${data[key]}`
			})
		}

		this.history.pushState({}, this.buildTitle(), "/" + this.rootRoute + routeName + extra)
		this.routeChanged(true)
	}

	/** Builds a title string for use in activity switching */
	private buildTitle(): string {
		return `${this.getCurrentActivity().title} | ${this.applicationName}`
	}

	/** Registers the activity for use by the framework. */
	private registerActivity(routeWithSlash: string, activity: Function): string {
		if (!routeWithSlash.includes("/")) throw new Error("Missing / from route.")
		const route = routeWithSlash.substr(1)
		let elementName = "activity-" + route
		const fullRoute = this.rootRoute + route

		if (!activity.prototype.switchedTo) {
			throw new Error("Cannot register this activity as it's not a valid activity class. Ensure it inherits from the `Activity` class, and that it contains the required `switchedTo` method.")
		}

		if (route) {
			if (this.registeredActivities[fullRoute]) {
				throw new Error("Route `" + route + "` already registered.")
			}
		} else {
			elementName = Application.DefaultActivityTag
		}

		// Define as an activity
		this.customElements.define(elementName, activity)
		this.registeredActivities[fullRoute] = elementName
		return route
	}

	/** A readonly copy of `location.pathname` */
	public readonly entryPoint: string = this.location.pathname

	/** Default activity as a tag name */
	public static DefaultActivityTag: string = "activity-default"

	/** Whether the application has been started with `.start()` */
	private started: boolean = false

	/** Starts the application */
	public start(args: {activityDefinitions: {[route: string]: Function}; componentDefinitions: Function[]}) {
		this.started = true

		for (let i = 0; i < args.componentDefinitions.length; i++) {
			const component = args.componentDefinitions[i]
			this.registerComponent(component)
		}

		for (let i = 0; i < Object.keys(args.activityDefinitions).length; i++) {
			const route = Object.keys(args.activityDefinitions)[i]
			this.registerActivity(route, args.activityDefinitions[route])
		}

		// Connect to the body of this window
		this.document.body.appendChild(this.$root)

		// Register hooks
		this.window.addEventListener("popstate", () => {
			this.routeChanged(true)
		})
		this.routeChanged(false)

		this.window.addEventListener("hashchange", () => {
			this.hashChanged()
		})
		this.hashChanged()

		// Start the default activity
		this.startActivity(Application.DefaultActivityTag, true)

		const t = performance.now() - this.constructTime
		console.info("Application `" + this.applicationName + "` started in", t, "ms")
		if (t > 1500) {
			console.warn("Heads up! Your application took longer than 1.5 seconds to start. Your user may bail in this time. Consider the size of your assets, along with the number of complex components you are loading.")
		}
	}
}
