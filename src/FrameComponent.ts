/** @format */

import Component from "./Component"

export type FrameCall = () => Promise<void> | void

export default abstract class FrameComponent extends Component {
	private readonly frameCalls: (FrameCall)[] = []
	private killSwitch: boolean = false

	public registerFrameCall(call: FrameCall) {
		this.frameCalls.push(call)
	}

	public unregisterFrameCall(call: FrameCall) {
		for (let i = 0; i < this.frameCalls.length; i++) {
			if (this.frameCalls[i] === call) {
				this.frameCalls.splice(i, 1)
				return
			}
		}

		throw new Error("Cannot destory frame call as it doesn't exist.")
	}

	async connectedCallback() {
		await super.connectedCallback()

		const frame = () => {
			if (this.killSwitch) return

			const promises: Promise<void>[] = []
			for (let i = 0; i < this.frameCalls.length; i++) {
				const maybePromise = this.frameCalls[i]()
				if (maybePromise) promises.push(maybePromise)
			}

			if (promises.length) {
				Promise.all(promises).then(() => {
					requestAnimationFrame(() => frame())
				})
			} else {
				requestAnimationFrame(() => frame())
			}
		}

		requestAnimationFrame(() => frame())
	}

	disconnectedCallback() {
		console.log(`${this.getClassName()} is disconnecting. Attempting to remove it's frame calls to preserve performance.`)

		// Enable kill switch to cut the `FrameRequestCallback` loop
		this.killSwitch = true

		// Clear frame calls
		for (let i = 0; i < this.frameCalls.length; i++) {
			this.frameCalls.splice(i, 1)
		}
	}
}
