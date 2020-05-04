/** @format */

import Component from "./Component"
import ModalComponent from "./ModalComponent"
import {WaitForAnimationFinish, DestroyWithAnimation} from "./DOMUtil"
import {sleepFrames} from "./util"

export default abstract class Activity extends Component {
	/** Container of modals created on this activity. */
	public $modalContainer = document.createElement("greenframe-activity-modal-container")

	/** Removes all created modals on the Activity. Directly replaces `<Application>.destroyAllModals()`. */
	public destroyAllModals() {
		const existingModals = Array.from(this.$modalContainer.children)
		console.warn("Deleting existing modals", this.tagName, existingModals)
		existingModals.forEach(($e) => {
			$e.setAttribute("destroyed", "")

			// TODO: all of this animation/destroy stuff should be rewritten and part of `util`

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

			sleepFrames(2).then(() => {
				if (!aniStarted) {
					console.warn("No animation declared for destroying this component. Declare :host([destroyed]) { /* ... */ } in your components CSS to add an animation when this component is destroyed. [" + $e.tagName + "]")
					$e.remove()
				}
			})
		})
	}

	/** Hooks registered to different modal creating functions. Consider using `.registerModal` to make this easier. */
	public registeredModalHooks: {[hash: string]: (properties: {[key: string]: string}) => ModalComponent | null} = {}

	/** Registers a hash function on this modal. */
	public hookModal(name: string, callback: ((properties: {[key: string]: string}) => ModalComponent | null) | (() => ModalComponent | null)) {
		// Register the new hash
		this.registeredModalHooks[name] = callback
	}

	/** Starts a modal via the modals hash name and with the properties provided. */
	public startModal(name: string, properties: {[key: string]: any} = {}) {
		name = name.replace("#", "") // remove extra hashes

		if (!this.registeredModalHooks[name]) {
			throw new Error("No modal is declared under the hash #" + name)
		}

		let extra = ""
		const keys = Object.keys(properties)
		keys.forEach((key, n) => {
			extra += `${n === 0 ? "?" : "&"}${key}=${JSON.stringify(properties[key])}`
		})

		// location.hash = "#" + name + extra
		history.pushState("GREENFRAME - started modal", this.app.$title.innerText, location.href.split("#")[0] + "#" + name + extra)

		this.app.hashChange()
	}

	/** The title of this activity. */
	public activityTitle?: string

	/** If this is `true` then fixed components are shown automatically when the Activity is switched to. If it's `false` it hides fixed components. If it's `undefined` it does nothing. */
	public automaticallyShowFixedComponents?: boolean

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
		this.$root.appendChild(this.$modalContainer)
		this.css(`
			:host {
				position: fixed;
				z-index: 1;
				width: 100%;

				display: flex;
				flex-flow: column nowrap;

				background: ${this.app.getSchemaProperty("applicationBackground")};

				top: var(--activity-top);
				left: var(--activity-left);
				bottom: var(--activity-bottom);
				right: var(--activity-right);
				height: var(--activity-height);
				width: var(--activity-width);
			}

			greenframe-activity-modal-container {
				display: block;
				z-index: 2;
				position: fixed;
				overflow: visible;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
			}

			greenframe-activity-modal-container:empty {
				display: none;
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

	public async destroy() {
		await DestroyWithAnimation(this)
	}

	/** Fires if the application requests to switch to the same activity it's already switched to, also can be fired manually. */
	public refresh?()
}

export abstract class ErrorActivity extends Activity {
	constructor(protected error: Error) {
		super()
	}
}
