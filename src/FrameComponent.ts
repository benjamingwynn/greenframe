/** @format */

import Component from "./Component"

export type FrameCall = () => Promise<void> | void

export default abstract class FrameComponent extends Component {
	private readonly frameCalls: FrameCall[] = []
	private killSwitch: boolean = false
	private _frameRequestID?: number

	public registerFrameCall(call: FrameCall) {
		this.frameCalls.push(call)
	}

	public unregisterAllFrameCalls() {
		this.frameCalls.splice(0, this.frameCalls.length)
	}

	public unregisterFrameCall(call: FrameCall) {
		for (let i = 0; i < this.frameCalls.length; i++) {
			if (this.frameCalls[i] === call) {
				this.frameCalls.splice(i, 1)
				return
			}
		}

		throw new Error("Cannot destroy frame call as it doesn't exist.")
	}

	private frame: FrameRequestCallback = () => {
		if (this.killSwitch) return

		const promises: Promise<void>[] = []
		for (let i = 0; i < this.frameCalls.length; i++) {
			const maybePromise = this.frameCalls[i]()
			if (maybePromise) promises.push(maybePromise)
		}

		if (promises.length) {
			Promise.all(promises).then(() => {
				this._frameRequestID = requestAnimationFrame(this.frame)
			})
		} else {
			this._frameRequestID = requestAnimationFrame(this.frame)
		}
	}

	async connectedCallback() {
		await super.connectedCallback()

		this._frameRequestID = requestAnimationFrame(this.frame)
	}

	disconnectedCallback() {
		console.log(`${this.getClassName()} is disconnecting. Removing it's frame calls to preserve performance.`)

		// Enable kill switch to cut the `FrameRequestCallback` loop
		this.killSwitch = true

		if (this._frameRequestID) cancelAnimationFrame(this._frameRequestID)

		// Clear frame calls
		for (let i = 0; i < this.frameCalls.length; i++) {
			this.frameCalls.splice(i, 1)
		}
	}
}
