/** @format */

/** Easily hooks dragging element around */
export const HookDrag = (
	$target: HTMLElement,
	button: number | null,
	hooks: {
		down: (e: MouseEvent, elementX: number, elementY: number) => void
		move: (e: MouseEvent, elementX: number, elementY: number) => void
		up: (e: MouseEvent, elementX: number, elementY: number) => void
	}
) => {
	const mousedown = (e: MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (button !== null && e.button !== button) return
		hooks.down(e, e.offsetX, e.offsetY)

		const $root = document

		const mousemove = (e: MouseEvent) => {
			// if (button !== null && e.button !== button) return
			e.preventDefault()
			e.stopPropagation()
			const box = $target.getBoundingClientRect()
			hooks.move(e, e.pageX - box.left, e.pageY - box.top)
		}

		const mouseup = (e: MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			$root.removeEventListener("mousemove", mousemove)
			$root.removeEventListener("mouseup", mouseup)

			// if (button !== null && e.button !== button) return
			const off = $target.getBoundingClientRect()
			hooks.up(e, e.offsetX + off.left, e.offsetY + off.top)
		}

		$root.addEventListener("mousemove", mousemove)
		$root.addEventListener("mouseup", mouseup)
	}

	if (button === 2) {
		$target.addEventListener("contextmenu", mousedown)
	} else {
		$target.addEventListener("mousedown", mousedown)
	}
}

export const BooleanToAttribute = ($target: HTMLElement, attributeName: string, bool: boolean): void => {
	if (bool) {
		$target.setAttribute(attributeName, "")
	} else {
		$target.removeAttribute(attributeName)
	}
}

class LoadFailedError extends Error {}

/**
 * Waits for an element to finish loading, then resolves a promise. If the image is already loaded the promise will *immediately* resolve.
 *
 * If the image fails to load then the function will throw LoadFailedError.
 * @throws LoadFailedError
 */
export const ForLoadOrFail = (element: HTMLImageElement): Promise<void> => {
	return new Promise((resolve, reject) => {
		if (element.complete) resolve()

		element.addEventListener("error", (error) => {
			reject(new LoadFailedError(error.message))
		})

		element.addEventListener("load", () => {
			resolve()
		})
	})
}

/** Waits for an element to finish loading, then resolves a promise. If the image is already loaded the promise will *immediately* resolve.
 *
 * @returns whether the image loaded successfully or not.
 */
export const ForLoad = (element: HTMLImageElement): Promise<boolean> => {
	return new Promise((resolve) => {
		ForLoadOrFail(element)
			.then(() => resolve(true))
			.catch(() => resolve(false))
	})
}

export const DirectClick = (element: Element, callback: () => void): void => {
	element.addEventListener("click", (ev) => {
		if (ev.composedPath()[0] === element) {
			ev.stopPropagation()
			callback()
		}
	})
}

export const Hide = (element: Element): void => {
	element.setAttribute("hidden", "")
}

export const Show = (element: Element): void => element.removeAttribute("hidden")


/** Fires a **callback every time an animation finishes** on the element, unlike the alternative `WaitForAnimationFinish` which resolves a promise the first time an animation finishes on the element. If you don't want to target the element exactly, use the native `addEventListener("animationend", <callback>)` call. */
export const AnimationFinish = (element: HTMLElement, callback: () => void) => {
	const eventListener = (ev: AnimationEvent) => {
		if (ev.target !== element) return // only target exactly
		console.log("Animation finished on", element, ev)
		callback()
	}
	element.addEventListener("animationend", eventListener)
}

/** Waits for an animation to complete before resolving, if a timeout is provided then the function will resolve after that time if the animation didn't complete. Note that due to the nature of Promises in Javascript only being able to resolve once, this can fire only once. If you wish to hook to an animation that is ran multiple times use `DOMUtil.AnimationFinish` */
export const WaitForAnimationFinish = (element: HTMLElement, timeout?: number, exact: boolean = true) => {
	return new Promise((resolve) => {
		let bail = false // we shouldn't need this because we use removeEventListener, but keep it just in case
		/** The timer for timing out the element animation. Cleared when animation complete. */
		let timer

		const removeEventListener = () => {
			element.removeEventListener("animationend", eventListener)
			bail = true
		}

		const eventListener = (ev: AnimationEvent) => {
			if (exact && ev.target !== element) return // only target exactly
			if (timer) clearTimeout(timer) // stop the timer firing
			if (bail) return
			removeEventListener()
			resolve()
		}

		element.addEventListener("animationend", eventListener)

		if (timeout) {
			timer = setTimeout(() => {
				removeEventListener()
				resolve()
			}, timeout)
		}
	})
}

// export {HookDrag, BooleanToAttribute, ForLoad as Load, ForLoadOrFail as LoadOrFail}
