/** @format */

import Component from "./Component"
import {ModalComponent, DOMUtil} from "./index"

abstract class Activity extends Component {
	private loadedScripts: {[url: string]: HTMLScriptElement} = {}

	public loadScript(url, async: boolean = false, defer: boolean = false): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.loadedScripts[url]) {
				console.log("Script", url, "is already loaded.")
				resolve()
			} else {
				const $script = document.createElement("script")
				$script.src = url
				$script.async = async
				$script.defer = defer
				this.loadedScripts[url] = $script
				$script.addEventListener("error", (ex) => {
					reject(ex)
				})
				$script.addEventListener("load", () => {
					console.warn("***** script", url, "loaded")
					resolve()
				})
				this.connect(this.loadedScripts[url])
			}
		})
	}

	public $modalContainer = document.createElement("greenframe-activity-modal-container")

	/** Hooks registered to different modal creating functions. Consider using `.registerModal` to make this easier. */
	public registeredModalHooks: {[hash: string]: (properties: {[key: string]: string}) => ModalComponent | null} = {}

	/** Registers a hash function on this modal. */
	public hookModal(name: string, callback: ((properties: {[key: string]: string}) => ModalComponent | null) | (() => ModalComponent | null)) {
		// Register the new hash
		this.registeredModalHooks[name] = callback

		// Force detect a hash change
		// this.app.hashChange(true)
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
		history.pushState(undefined, this.app.$title.innerText, location.href.split("#")[0] + "#" + name + extra)

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

	public destroy() {
		this.setAttribute("destroyed", "")
		DOMUtil.WaitForAnimationFinish(this, 600).then(() => {
			this.remove()
		})
	}

	/** Fires if the application requests to switch to the same activity it's already switched to, also can be fired manually. */
	public refresh?()
}

export default Activity
