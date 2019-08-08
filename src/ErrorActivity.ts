/** @format */
import Activity from "./Activity"

export default abstract class ErrorActivity extends Activity {
	fixedComponentVisibility = false
	constructor(protected error: Error) {
		super()
	}
}
