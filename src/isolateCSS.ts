/** @format */

// Fork of https://github.com/benjamingwynn/invented.js/blob/master/src/isolateCSS.ts
import * as css from "css"

function replaceAll(target: string, replaceThis: string | Array<string>, withThis: string): string {
	if (typeof replaceThis === "string") {
		return target.split(replaceThis).join(withThis)
	} else {
		let output = ""

		replaceThis.forEach((replaceThis2) => {
			output = replaceAll(output, replaceThis2, withThis)
		})

		return output
	}
}

function purgeString(target: string, purgeThis: string | Array<string>): string {
	return replaceAll(target, purgeThis, "")
}

export function renameCSSSelectorToken(stylesheet: string, replaceToken: string, withToken: string, deleteBrackets: boolean = false): string {
	const cssTree = css.parse(stylesheet)

	if (!cssTree.stylesheet || !cssTree.stylesheet.rules) {
		throw new Error("CSS appears to not have any valid rules.")
	}

	cssTree.stylesheet.rules.forEach((node: css.Rule | any) => {
		if (node.type !== "rule") return

		if (!node.selectors) {
			console.warn("Weird. node.selectors isn't defined.")
			return
		}

		for (var i = 0; i < node.selectors.length; i += 1) {
			if (deleteBrackets) {
				if (node.selectors[i].includes(replaceToken + "(")) {
					node.selectors[i] = node.selectors[i].replace("(", "")
					node.selectors[i] = node.selectors[i].replace(")", "")
				}
			}

			if (node.selectors[i].includes(replaceToken)) {
				node.selectors[i] = node.selectors[i].split(replaceToken).join(withToken)
			}
		}
	})

	return css.stringify(cssTree)
}

export function isolateCSS(namespace: string, stylesheet: string): string {
	// TODO: Scoped animations

	const cssTree = css.parse(stylesheet)

	if (!cssTree.stylesheet || !cssTree.stylesheet.rules) {
		console.error("CSS appears to not have any valid rules.")
		return ""
	}

	cssTree.stylesheet.rules.forEach((node: css.Rule | any) => {
		if (node.type !== "rule") return

		if (!node.selectors) {
			console.warn("Weird. node.selectors isn't defined")
			return
		}

		for (var i = 0; i < node.selectors.length; i += 1) {
			// if (node.selectors[i].indexOf(":root ") === -1 && node.selectors[i].indexOf(":root") === 0) {
			// rename :root to the namespace
			// node.selectors[i] = node.selectors[i].replace(":root", `.${namespace}`)
			if (node.selectors[i].includes(":host(")) {
				// remove first brackets
				node.selectors[i] = node.selectors[i].replace("(", "")
				node.selectors[i] = node.selectors[i].replace(")", "")
			}

			if (node.selectors[i].includes(":host")) {
				node.selectors[i] = node.selectors[i].split(":host").join("." + namespace)
			} else {
				// remove the root declaration and add namespace
				node.selectors[i] = purgeString(`.${namespace} ${node.selectors[i]}`, ":root ")
			}
		}
	})

	// add CSS to the DOM
	return css.stringify(cssTree)
}
