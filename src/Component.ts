/** @format */

import Application from "./Application"
import ComponentCore from "./ComponentCore"

window.addEventListener("unhandledrejection", (ex) => {
	if (ex.reason && ex.reason.message === "Illegal constructor") {
		console.warn("🌳🏗 It looks like you might be trying to construct a component using `new ()` without registering it first, make sure your `app.start()` includes all the definitions you're trying to use in your app.")
		// console.log(ex)
	}
})

window.addEventListener("error", (ex) => {
	console.log(ex)
	if (ex.message === "Uncaught TypeError: Illegal constructor") {
		console.warn("🌳🏗 It looks like you might be trying to construct a component using `new ()` without registering it first, make sure your `app.start()` includes all the definitions you're trying to use in your app.")
		// console.log(ex)
	}
})

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
export default abstract class Component extends ComponentCore {
	/** Back-reference to the app this component was created on. */
	public get app(): Application {
		const app = <any>window["app"]
		if (app instanceof Application) {
			return <Application>app
		} else {
			throw new Error("`app` property is missing on the global `window` property. Has the application been started?")
		}
	}

	/** Returns whether the element is visible by the UA or not. */
	public get visible(): boolean {
		const vis = this.getBoundingClientRect().top <= window.innerHeight && this.getBoundingClientRect().bottom > 0 && getComputedStyle(this).visibility !== "hidden"
		const activity = this.getActivity()
		if (activity) {
			if (this.app.isActivityActive(activity)) {
				return vis
			} else {
				return false
			}
		} else {
			return vis
		}
	}
}

/** Add default styling. */
Component.addCommonCSS(`
	:host {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Emoji', "Segoe UI", Roboto, Helvetica, system-ui, sans-serif;
		font-size: 1em;
		cursor: default;
		user-select: none;
		box-sizing: border-box;
		color: var(--schema-text);
	}

	* {
		-webkit-tap-highlight-color: transparent;
		-webkit-user-drag: none;
		-webkit-appearance: none;
		box-sizing: border-box;
		font-size: 1em;
		outline: 0;
	}

	style, script, link, meta {
		display: none !important;
	}

	[hidden] {
		display: none;
	}

	button > * {
		cursor: inherit;
	}

	a {
		color: inherit;
	}
`)
