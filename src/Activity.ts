/** @format */

import Component from "./Component"
import {ModalComponent} from "./index"

abstract class Activity extends Component {

	/** Hooks registered to different modal creating functions. Consider using `.registerModal` to make this easier. */
	public registeredModalHooks: {[hash: string]: (properties: {[key: string]: string}) => ModalComponent | null} = {}

	/** Registers a hash function on this modal. */
	public hookModal(name: string, callback: (properties: {[key: string]: string}) => ModalComponent | null) {
		// Register
		this.registeredModalHooks[name] = callback
		// Detect a hash change
		this.app.hashChange()
	}

	/** Starts a modal via the modals hash name and with the properties provided. */
	public startModal(name: string, properties: {[key: string]: any} = {}) {
		if (!this.registeredModalHooks[name]) {
			throw new Error("No modal is declared under the hash #" + name)
		}

		let extra = ""
		const keys = Object.keys(properties)
		keys.forEach((key, n) => {
			extra += `${n === 0 ? "?" : "&"}${key}=${JSON.stringify(properties[key])}`
		})

		// location.hash = "#" + name + extra
		history.pushState({}, "", location.href.split("#")[0] + "#" + name + extra)

		this.app.hashChange()
	}

	/** The title of this activity. */
	public activityTitle?: string

	/** Fires when the activity is switched to. Unlike `setup`, this is fired every time the component is switched to. `setup` is only fired when the component is loaded. */
	abstract switchedTo(args: {[key: string]: string}): void

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
		this.css(`
			:host {
				position: fixed;
				width: 100%;

				display: flex;
				flex-flow: column nowrap;

				background: ${this.app.getSchemaProperty("applicationBackground")};

				top: var(--activity-top);
				left: var(--activity-left);
				bottom: var(--activity-bottom);
				right: var(--activity-right);
				height: calc(100% - var(--activity-top) - var(--activity-bottom));
				width: calc(100% - var(--activity-left) - var(--activity-right));
			}

			:host([animate]) {
				animation: activity-in var(--animation-time);
			}

			:host([destroyed]) {
				animation: activity-out var(--animation-time);
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
		`)

		this.setAttribute("activity", "")
		super.connectedCallback()
	}

	public destroy() {
		this.setAttribute("destroyed", "")
		this.addEventListener("animationend", () => {
			this.remove()
		})
	}

	/** Fires if the application requests to switch to the same activity it's already switched to, also can be fired manually. */
	public refresh?()
}

export default Activity
