/** @format */

import FrameComponent from "./FrameComponent"

/** Empty component for running comparisons against. */
class DummyComponent extends FrameComponent {
	setup() {
		// ...
	}
}

export enum ReactionMode {
	/** Fires a function with a similar name to the element */
	Function = 1,
	/** Adjusts the CSS property related to this. */
	CSSVariable = 2,
}

customElements.define("dummy-component", DummyComponent)
/** Reactive components react to any properties that are adjusted on their class. */
export default abstract class ReactiveComponent extends FrameComponent {
	static LogReactions = false
	static LogSetup = false

	private log(msg: string) {
		console.log(`⚛️ ${this.getClassName()} ℹ️`, msg)
	}

	private setupLog(msg: string) {
		if (ReactiveComponent.LogSetup) console.log(`⚛️ ${this.getClassName()} ℹ️`, msg)
	}

	public reactPropertiesNames: string[] = []
	private reactPropertiesValues: {[property: string]: any} = []

	/** Override with `reactMode = ReactionMode.Function` or `reactMode = ReactionMode.Function + ReactionMode.CSSVariable` */
	protected reactMode: ReactionMode = ReactionMode.CSSVariable + ReactionMode.Function

	private propertyWatcher = () => {
		if (!this.connectedCallbackFinished) {
			console.log("This element isn't connected yet.")
			return
		}

		for (let i = 0; i < this.reactPropertiesNames.length; i++) {
			const prop = this.reactPropertiesNames[i]
			const lastValue = this.reactPropertiesValues[prop]
			const currentValue = this[prop]

			const setCSS = () => {
				if (typeof currentValue === "number") {
					this.style.setProperty(ReactiveComponent.buildCSSVarNameFromProp(prop), `${currentValue}`)
				} else if (typeof currentValue === "string") {
					this.style.setProperty(ReactiveComponent.buildCSSVarNameFromProp(prop), `"${currentValue}"`)
				} else if (typeof currentValue === "boolean") {
					if (currentValue) {
						this.setAttribute(ReactiveComponent.buildAttributeNameFromProp(prop), "")
					} else {
						this.removeAttribute(ReactiveComponent.buildAttributeNameFromProp(prop))
					}
				}
			}

			if (lastValue !== currentValue) {
				if (ReactiveComponent.LogReactions) this.log(`React! this.${prop}: ${lastValue} → ${currentValue}`)

				const functionName = ReactiveComponent.buildFunctionNameFromProp(prop)

				if (this.reactMode === ReactionMode.Function + ReactionMode.CSSVariable) {
					if (functionName in this && typeof this[functionName] === "function") {
						this[functionName](currentValue)
						setCSS()
					} else {
						setCSS()
					}
				} else if (this.reactMode === ReactionMode.CSSVariable) {
					setCSS()
				} else if (functionName in this && typeof this[functionName] === "function") {
					this[functionName](currentValue)
				} else {
					throw new Error("Cannot safely call the function from the reaction.")
				}

				// update cache
				this.reactPropertiesValues[prop] = currentValue
			}
		}
	}

	private static buildFunctionNameFromProp(prop: string) {
		return `react${prop
			.split("")
			.map((x, i) => (i ? x : x.toUpperCase()))
			.join("")}`
	}

	private static buildAttributeNameFromProp(prop: string) {
		/** @see https://gist.github.com/nblackburn/875e6ff75bc8ce171c758bf75f304707 */
		return prop.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
	}

	private static buildCSSVarNameFromProp(prop: string) {
		return "--" + this.buildAttributeNameFromProp(prop)
	}

	// async connectedCallback() {
	// 	console.log("reactive cc")
	// 	await super.connectedCallback()
	// 	console.log("reactive post-cc")
	// }

	constructor(isolate?: boolean) {
		super(isolate)
		const keysReact = Object.keys(this)

		/** HACK: Wait for frame so we get all the properties of a sub-class post-construction. */
		requestAnimationFrame(() => {
			const keysThis = Object.keys(this)
			const keysComp = Object.keys(document.createElement("dummy-component"))
			const considerWatching = keysThis.filter((x) => !keysComp.includes(x) && !keysReact.includes(x) && x !== "reactMode" && x[0] !== "_")
			for (let i = 0; i < considerWatching.length; i++) {
				const prop = considerWatching[i]
				const value = this[prop]
				if (prop.indexOf("react") === 0 && typeof value === "function") {
					this.setupLog(`Not watching \`this.${prop}\`, as it's a reaction function.`)
					continue
				}
				const functionName = ReactiveComponent.buildFunctionNameFromProp(prop)
				if (this.reactMode === ReactionMode.Function + ReactionMode.CSSVariable) {
					if (functionName in this && typeof this[functionName] === "function") {
						if (typeof value === "string" || typeof value === "number") {
							this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. A function exists, so I'll fire \`this.${functionName}()\` and adjust CSS variable \`${ReactiveComponent.buildCSSVarNameFromProp(prop)}\``)
							this.style.setProperty(ReactiveComponent.buildCSSVarNameFromProp(prop), String(value))
						} else {
							this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. A function exists, so I'll fire \`this.${functionName}()\`. I won't adjust the CSS variable as this is neither a string or a number.`)
						}
						this.reactPropertiesNames.push(prop)
					} else if (typeof value === "string" || typeof value === "number") {
						this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. A function for this doesn't exist, so I'll *ONLY* modify the CSS Variable: ${ReactiveComponent.buildCSSVarNameFromProp(prop)}. Declare \`this.${functionName}()\` to react to a function instead.`)
						this.reactPropertiesNames.push(prop)
					} else if (typeof value === "boolean") {
						this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. A function for this doesn't exist. Because ReactionMode is set to CSSVariable and this is a boolean, I'll instead set/remove the attribute \`${prop}\`. Declare \`this.${functionName}()\` to react to a function instead.`)
						this.reactPropertiesNames.push(prop)
					} else {
						this.setupLog(`Not watching \`this.${prop}\` as it is not a string or number, so cannot be converted to a CSS variable. Declare \`this.${functionName}()\` to react to a function instead.`)
					}
				} else if (this.reactMode === ReactionMode.Function && functionName in this && typeof this[functionName] === "function") {
					this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. Will fire this.${functionName}()`)
					this.reactPropertiesNames.push(prop)
				} else if (this.reactMode === ReactionMode.CSSVariable) {
					if (typeof value === "boolean") {
						this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. Because ReactionMode is set to CSSVariable and this is a boolean, I'll instead set/remove the attribute \`${prop}\``)
						this.reactPropertiesNames.push(prop)
					} else if (typeof value === "string" || typeof value === "number") {
						this.setupLog(`Watching \`this.${prop}\`. Initial value: ${value}. Will modify the CSS Variable: ${ReactiveComponent.buildCSSVarNameFromProp(prop)}`)
						this.reactPropertiesNames.push(prop)
					} else {
						this.setupLog(`Cannot watch \`this.${prop}\`. ReactionMode is set to CSSVariable and the property is neither a string, number or a boolean.`)
					}
				} else {
					this.setupLog(`Not watching \`this.${prop}\`. Define \`${this.getClassName()}.${functionName}()\` to watch changes to this property.`)
				}
			}

			if (this.reactPropertiesNames.length) {
				this.registerFrameCall(this.propertyWatcher)
				this.setupLog("Registered the property watcher.")
			} else {
				this.setupLog("Not watching any properties so I'm not going to run my reaction check to save performance.")
			}
		})
	}
}
