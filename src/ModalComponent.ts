/** @format */
import Component from "./Component"

export default abstract class ModalComponent extends Component {
	type: "hash" | "attached" | "unattached" = "unattached"

	public removeModal() {
		if (this.type === "hash") {
			// if we have history, go back
			if (history.state) {
				history.back()
			} else {
				location.hash = ""
			}
		} else if (this.type === "attached") {
			this.setAttribute("destroyed", "")
			this.addEventListener("animationend", () => {
				this.remove()
			})
		}
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
