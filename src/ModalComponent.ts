/** @format */
import ReactiveComponent from "./ReactiveComponent"

export default abstract class ModalComponent extends ReactiveComponent {
	type: "hash" | "attached" | "unattached" = "unattached"

	private removing: boolean = false
	public removeModal() {
		return new Promise((resolve) => {
			if (this.removing) return resolve()

			this.removing = true
			if (this.type === "hash") {
				// if we have history, go back
				if (history.state) {
					history.back()
				} else {
					location.hash = ""
				}

				this.addEventListener("animationend", () => {
					resolve()
				})
			} else if (this.type === "attached") {
				this.app.showFixedComponents() // show fixed components manually, in hash this is done on change

				this.setAttribute("destroyed", "")
				this.addEventListener("animationend", () => {
					resolve()
					this.remove()
				})
			}
		})
	}

	async connectedCallback() {
		await super.connectedCallback()

		this.addEventListener("click", (ev) => {
			if (ev.composedPath()[0] === this) {
				this.removeModal()
			}
		})
	}
}
