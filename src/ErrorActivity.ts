/** @format */
import Activity from "./Activity"

export default abstract class ErrorActivity extends Activity {
	constructor(protected error: Error) {
		super()
	}
}
