/** @format */

import Component from "./Component"

// Create title if none exists
if (!document.head.querySelector("title")) {
	const $newTitle = document.createElement("title")
	document.head.appendChild($newTitle)
}

const $title = <HTMLTitleElement>document.head.querySelector("title")

const originalTitle = $title.innerText

/** Default activity as a tag */
/** Map of the registered activities via routename. Value is the string of the defined custom element. */
const registeredActivities: {[routeName: string]: string} = {}

function getPageArguments(): {[key: string]: string} {
	// https://stackoverflow.com/questions/6539761/window-location-search-query-as-json

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

function getHashArguments(): {[key: string]: string} {
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

function routeChanged(animate: boolean) {
	const thisRoute = Activity.GetCurrentActivityAsRoute()

	function switchTo(activity: Activity) {
		if (activity.FriendlyName) {
			$title.innerText = `${activity.FriendlyName} | ${originalTitle}`
		} else {
			$title.innerText = originalTitle
		}

		if (!activity.shadowRoot) throw new Error("Missing shadowRoot for routed activity.")

		const $prev = Activity.History[Activity.History.length - 1]
		// console.warn($prev, $prev ? $prev.hasAttribute("modal") : "no prev")
		activity.switchedTo(getPageArguments(), $prev ? $prev.hasAttribute("modal") : false)

		// clear registered hashes
		// Activity.CurrentRegisteredHashes = {}

		Activity.History.push(activity)
	}

	// console.log("Switching route. This route is", thisRoute, registeredActivities)
	const keys = Object.keys(registeredActivities)
	for (let i = 0; i < keys.length; i++) {
		const targetRoute = keys[i]

		if (thisRoute === targetRoute) {
			const $a = Activity.startActivity(registeredActivities[thisRoute], !animate)
			$a.removeAttribute("target-not-found")
			switchTo($a)
			return
		}
	}

	// Start default instead
	if (Activity.DefaultActivity) {
		const $target = Activity.startActivity(Activity.DefaultActivity, true)
		$target.setAttribute("target-not-found", "")
		switchTo($target)
	} else {
		throw new Error("No default route provided, and an invalid route was passed.")
	}
}

/** Returns whether the application is in PWA "standalone" mode. */
function isAppInstalled(): boolean {
	return window.matchMedia("(display-mode: standalone)").matches
}

// Component.addCommonCSS(`
// 	.fixed-component, .fixed-component[hidden] {
// 		display: initial;
// 	}
// `)

class ActivityRoot extends Component {
	constructor() {
		super(
			`
				<div id="modal-container"></div>
			`,
			`
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
		// throw new Error("Method not implemented.")
	}
}

Component.registerComponent(ActivityRoot)

abstract class Activity extends Component {
	static readonly ApplicationRoot = new ActivityRoot()
	static readonly ApplicationModalContainer = Activity.ApplicationRoot.$("#modal-container")

	static DeclareGlobalStyleProperty(propertyName: string, value: string): void {
		Activity.ApplicationRoot.style.setProperty(propertyName, value)
	}

	static GetCurrentActivityAsRoute(): string {
		return (
			Activity.ActivityRouteRoot +
			location.pathname
				.substr(1)
				.split("/")
				[Activity.ActivityRouteRoot.split("/").length - 1].trim()
		)
	}

	// static getCurrentActivityAsRoute(): string {
	// 	const keys = Object.keys(registeredActivities)
	// 	for (let i = 0; i < keys.length; i++) {
	// 		const routeName = keys[i]
	// 		const tagName = registeredActivities[routeName]
	// 		if (this.getCurrentActivityAsRoute() === tagName) {
	// 			return routeName
	// 		}
	// 	}
	// 	throw new Error("Could not determine the current activity as a route.")
	// }

	static FixedComponents: HTMLElement[] = []

	static HideFixedComponents(): void {
		Activity.UpdateFixedComponentPositions = false
		Activity.ApplicationRoot.style.setProperty("--activity-top", "0px")
		Activity.ApplicationRoot.style.setProperty("--activity-left", "0px")
		Activity.ApplicationRoot.style.setProperty("--activity-right", "0px")
		Activity.ApplicationRoot.style.setProperty("--activity-bottom", "0px")
		Activity.FixedComponents.forEach(($comp) => {
			if ($comp.style.bottom === "0px") {
				$comp.style.transform = "translateY(100%)"
			}

			// TODO: other directions
		})
	}

	static ShowFixedComponents(): void {
		Activity.UpdateFixedComponentPositions = true
		Activity.FixedComponents.forEach(($comp) => {
			$comp.style.transform = ""
		})
	}

	static UpdateFixedComponentPositions = true

	/** Registers an element to keep either to the top/bottom/left/right of all activities. */
	static RegisterFixedComponent(anchor: "top" | "left" | "bottom" | "right", element: HTMLElement): void {
		element.classList.add("fixed-component")
		element.style.position = "fixed"
		element.style[anchor] = "0px"
		Activity.FixedComponents.push(element)
		// element.style.zIndex = "1"

		// switch (anchor) {
		// 	case "bottom": {
		// 		element.style.bottom = "0px"
		// 		element.style.left = "0px"
		// 		element.style.right = "0px"
		// 	}
		// }

		Activity.ApplicationRoot.$root.appendChild(element)

		let cached: number = 0
		const keepPositionValid = () => {
			if (Activity.UpdateFixedComponentPositions) {
				const rect = element.getBoundingClientRect()

				let value: number
				if (anchor === "left" || anchor === "right") {
					value = rect.width
				} else {
					value = rect.height
				}

				if (cached !== value) {
					cached = value
					Activity.ApplicationRoot.style.setProperty("--activity-" + anchor, value + "px")
				}
			}

			requestAnimationFrame(keepPositionValid)
		}
		requestAnimationFrame(keepPositionValid)
	}

	/** Starts Activity logic. This must be called before any major called, call directly after assets are loaded. */
	static RegisterDefaultActivity(f: Function): string {
		Activity.RegisterActivity(f, "")
		return ""
	}

	private registeredModalHooks: {[hash: string]: (properties: {[key: string]: string}) => HTMLElement} = {}

	/** Registers a hash function. */
	protected registerModal(trigger: HTMLElement, hash: string, callback: (properties: {[key: string]: string}) => HTMLElement) {
		trigger.addEventListener("click", (ev) => {
			ev.preventDefault()
			location.hash = hash
		})
		this.registeredModalHooks[hash] = callback
	}

	static StartApplication() {
		// Add the root
		document.body.appendChild(Activity.ApplicationRoot)

		Activity.startActivity(Activity.DefaultActivity, true)

		const $a = Activity.startActivity(Activity.DefaultActivity, true)
		$a.removeAttribute("target-not-found")
		$a.setAttribute("via-route", "")

		window.addEventListener("popstate", () => {
			routeChanged(true)
		})

		const hashChanged = () => {
			// delete existing modal's
			Array.from(Activity.ApplicationModalContainer.children).forEach(($e) => {
				// let aniStarted = false
				// $e.addEventListener("animationstart", () => {
				// aniStarted = true
				$e.addEventListener("animationend", () => {
					$e.remove()
				})
				// })

				$e.setAttribute("destroyed", "")

				// setTimeout(() => {
				// if (!aniStarted) {
				// console.warn("No animation provided for this item. Removing manually.")
				// $e.remove()
				// }
				// }, 100)
			})

			// Activity.ShowFixedComponents()

			const hash = location.hash.split("?")[0].substr(1)

			if (hash) {
				const functionObject = Activity.GetCurrentActivity().registeredModalHooks[hash]
				console.log("Hash changed:", hash, functionObject)

				if (functionObject) {
					if (typeof functionObject !== "function") throw new Error("Registered hash object is not a function.")

					// Activity.HideFixedComponents()

					const args = getHashArguments()
					const $modal = functionObject(args)
					Activity.ApplicationModalContainer.appendChild($modal)
					// functionObject(Activity.ApplicationModalContainer, args)
				}
			} else {
				console.log("Hash is empty.")
			}
		}

		window.addEventListener("hashchange", () => {
			hashChanged()
		})

		// Add changed route
		routeChanged(false)

		hashChanged()

		console.log("Application started in", performance.now(), "ms")
	}

	/** The history of Activities navigated to by the user. */
	static readonly History: Activity[] = []

	/** A readonly copy of `location.pathname` */
	static readonly EntryPoint: string = location.pathname

	/** Default activity as a tag name */
	static DefaultActivity: string

	/** Route all activities are under. Used for reverse proxies serving multiple frontends. */
	static readonly ActivityRouteRoot: string = ""

	/** Friendly name for the activity. This will affect the title string of the activity. */
	public readonly FriendlyName?: string = ""

	static startActivity(activityTag: string, dontAnimate?: boolean): Activity {
		const $active = <Activity | null>Activity.ApplicationRoot.$_("" + activityTag + ":last-child:not([destroyed])")

		if ($active) {
			console.log("This activity is already active. Not starting it.")
			return $active
		} else {
			// check if the activity we already want exists
			const $existing = <Activity>Activity.ApplicationRoot.$_(`${activityTag}:not([destroyed])`)
			if ($existing) {
				console.log("the element already exists!")
				// get all the activities after the existing one
				let $next = $existing.nextElementSibling
				while ($next) {
					if ($next.hasAttribute("activity")) {
						;(<Activity>$next).destroy()
						console.log("Destroying", $next)
					}

					$next = $next.nextElementSibling
				}
				return $existing
			} else {
				const $a = <Activity>document.createElement(activityTag)

				if (!dontAnimate) {
					$a.setAttribute("animate", "")
				}

				Activity.ApplicationRoot.$root.appendChild($a)
				return $a
			}
		}
	}

	/** Fires when the activity is switched to. */
	public abstract async switchedTo(args: {[key: string]: string}, switchedFromModal: boolean): Promise<void>

	/** Goes back to the previous activity if we were at one, otherwise goes to the default */
	static Back() {
		if (history.state) {
			history.back()
		} else {
			// Switch to the default activity if we didn't get here via a previous activity
			Activity.SwitchToMainActivity()
		}
	}

	/** Switch back to the main activity */
	static SwitchToMainActivity() {
		Activity.SwitchActivityViaRouteName("")
	}

	static GetAllActivities(): Activity[] {
		const $$nodes = Activity.ApplicationRoot.$root.querySelectorAll("[activity]")
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

	static GetCurrentActivity(): Activity /*| undefined*/ {
		const $$a = Activity.GetAllActivities()
		return $$a[$$a.length - 1]
	}

	static GetDefaultActivity(): Activity {
		if (Activity.DefaultActivity) {
			return <Activity>document.querySelector(Activity.DefaultActivity)
		} else {
			throw new Error("No default activity provided")
		}
	}

	static LastActivity = location.pathname.substr(1) // main

	static SwitchActivityViaRouteName(routeName: string, data?: {[key: string]: string}) {
		Activity.LastActivity = location.pathname.substr(1)

		let extra = ""

		if (data) {
			const keys = Object.keys(data)
			keys.forEach((key, n) => {
				extra += `${n === 0 ? "?" : "&"}${key}=${data[key]}`
			})
		}

		// TODO: name this "title" something else
		history.pushState({}, "dev.memehub.com", "/" + Activity.ActivityRouteRoot + routeName + extra)
		routeChanged(true)
	}

	/** Registers the activity for use by the component engine. */
	static RegisterActivity(activity: Function, route: string): string {
		let elementName = "activity-" + route
		const fullRoute = Activity.ActivityRouteRoot + route

		if (!activity.prototype.switchedTo) {
			throw new Error("Cannot register this activity as it's not a valid activity class. Ensure it inherits from the `Activity` class, and that it contains the `switchedTo` method.")
		}

		if (route) {
			if (registeredActivities[fullRoute]) {
				throw new Error("Route already registered.")
			}
		} else {
			if (Activity.DefaultActivity) {
				throw new Error("A default activity is already registered.")
			} else {
				elementName = "activity-default"
				Activity.DefaultActivity = elementName
			}
		}

		// Define as an activity
		customElements.define(elementName, activity)
		registeredActivities[fullRoute] = elementName
		return route
	}

	constructor(initialHTML: string, initialCSS: string) {
		super(
			initialHTML,
			`
			:host {
				position: fixed;
				bottom: 0;
				left: 0;
				right: 0;
				width: 100%;

				top: var(--activity-top);
				left: var(--activity-left);
				bottom: var(--activity-bottom);
				right: var(--activity-right);
				height: calc(100% - var(--activity-top) - var(--activity-bottom));
				width: calc(100% - var(--activity-left) - var(--activity-right));
				color: black;
			}

			:host([animate]) {
				animation: activity-in 0.2s;
			}

			:host([destroyed]) {
				animation: activity-out 0.2s;
			}

			@keyframes activity-in {
				from {
					opacity: 0;
					transform: translateX(50%);
				}
			}

			@keyframes activity-out {
				to {
					opacity: 0;
					transform: translateX(50%);
				}
			}

			${initialCSS}
		`
		)

		if (!this.isActivity) {
			throw new Error("This class isn't a valid activity. It must extend the Activity class.")
		}

		// Ensure this class is declared through the right function
		const tags = Object.keys(registeredActivities)
		let okay = false
		tags.forEach((route) => {
			const tagName = registeredActivities[route]
			if (tagName === this.tagName.toLowerCase()) {
				okay = true
			}
		})
		if (!okay) {
			throw new Error("Activity was not declared via registerActivity. Please use registerActivity instead of customElements.define for <Activity> classes.")
		}
	}

	/** Whether this is the main activity */
	public isDefaultActivity() {
		return this.tagName.toLowerCase() === "activity-default"
	}

	/** Whether the two activities are of the same type. */
	public isSameActivity($item: Activity): boolean {
		return $item.tagName.toLowerCase() === this.tagName.toLowerCase()
	}

	public readonly isActivity = true

	public async connectedCallback() {
		super.connectedCallback()
		this.setAttribute("activity", "")
	}

	public destroy() {
		this.setAttribute("destroyed", "")
		this.addEventListener("animationend", () => {
			this.remove()
		})
	}
}

export default Activity
