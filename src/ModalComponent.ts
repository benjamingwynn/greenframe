/** @format */
import Component from "./Component"

export default abstract class ModalComponent extends Component {
	type: "hash" | "attached" | "unattached" = "unattached"

	public removeModal() {
		if (this.type === "hash") {
			location.hash = ""
		} else if (this.type === "attached") {
			this.remove()
		}
	}
}
