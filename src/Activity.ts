/** @format */

import Component from "./Component"

abstract class Activity extends Component {
	/** Hooks registered to different modal creating functions. Consider using `.registerModal` to make this easier. */
	public registeredModalHooks: {[hash: string]: (properties: {[key: string]: string}) => HTMLElement} = {}

	/** Registers a hash function on this modal. */
	protected registerModal(hash: string, callback: (properties: {[key: string]: string}) => HTMLElement, trigger?: HTMLElement) {
		if (trigger) {
			trigger.addEventListener("click", (ev) => {
				ev.preventDefault()
				location.hash = hash
			})
		}

		this.registeredModalHooks[hash] = callback
	}

	/** The title of this activity. */
	abstract activityTitle: string

	/** Fires when the activity is switched to. Unlike `setup`, this is fired every time the component is switched to. `setup` is only fired when the component is loaded. */
	abstract switchedTo(args: {[key: string]: string}): Promise<void> | void

	constructor(initialHTML: string, initialCSS: string) {
		super(
			initialHTML,
			`
			:host {
				position: fixed;
				width: 100%;

				top: var(--activity-top);
				left: var(--activity-left);
				bottom: var(--activity-bottom);
				right: var(--activity-right);
				height: calc(100% - var(--activity-top) - var(--activity-bottom));
				width: calc(100% - var(--activity-left) - var(--activity-right));
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

		// TODO: Ensure this class is declared through the right function
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
