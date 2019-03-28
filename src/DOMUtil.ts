/** @format */

/** Easily hooks dragging element around */
const HookDrag = (
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

const BooleanToAttribute = ($target: HTMLElement, attributeName: string, bool: boolean): void => {
	if (bool) {
		$target.setAttribute(attributeName, "")
	} else {
		$target.removeAttribute(attributeName)
	}
}

export {HookDrag, BooleanToAttribute}
