/** @format */

import Activity from "./Activity"
import Layout from "./Layout"
import {H, P} from "./E"
import Application from "./Application"
import {ComponentBase} from "./ComponentBase"

export class ComponentConnectionTimeoutError extends Error {}

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
export default abstract class Component extends ComponentBase {
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

	/**
	 * Connect this component and wait for it to finish it's setup function before resolving a promise.
	 *
	 * Optionally, a timeout may be provided. If the component does not connect in the time provided by the timeout then a ComponentConnectionTimeoutError will be thrown.
	 *
	 * Additionally, the `waitForVisible` argument can be used to wait until the element is `visible`
	 */
	public connectToAndWait($to: HTMLElement | ComponentBase, timeout?: number, waitForVisible?: true): Promise<void> {
		const bailTime = timeout ? Date.now() + timeout : Infinity
		return new Promise((resolve, reject) => {
			this.connectTo($to)
			const f = () => {
				if (bailTime !== Infinity && Date.now() > bailTime) {
					$to.remove()
					console.warn($to.tagName, "didn't connect in time and was destroyed.")
					reject(new ComponentConnectionTimeoutError())
				} else {
					if (this.connectedCallbackFinished && (!waitForVisible || (waitForVisible && this instanceof Component && this.visible))) {
						resolve()
					} else {
						requestAnimationFrame(f)
					}
				}
			}
			requestAnimationFrame(f)
		})
	}

	/** Back-reference to the parent activity of the current component. */
	private _parentActivity?: Activity

	/** Gets the activity the component is attached to. */
	public getActivity(): Activity | null {
		if (this instanceof Activity) {
			console.warn("Activity instance requested getActivity(), just use `this` on it.")
			return this
			// } else if (this instanceof Component) {
			// return this.app.getCurrentActivity()
		} else {
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
	}

	public getActivityOrFail(): Activity {
		const a = this.getActivity()
		if (!a) throw new Error("Could not get activity of component.")
		return a
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
