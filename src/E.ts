/** @format */

export const P = (str: string) => {
	const p = document.createElement("p")
	p.innerText = str
	return p
}

export const H = (str: string) => {
	const h = document.createElement("h1")
	h.innerText = str
	return h
}

export const DIV = (id?: string, elements: Element[] = []): HTMLDivElement => {
	const d = document.createElement("div")
	if (id) {
		if (id[0] === ".") {
			d.className = id.split(".").join(" ").trim()
		} else {
			d.id = id.replace("#", "")
		}
	}
	for (let i = 0; i < elements.length; i++) {
		const e = elements[i]
		d.appendChild(e)
	}
	return d
}

export const BUTTON = (text: string, action: () => any): HTMLButtonElement => {
	const button = document.createElement("button")
	button.addEventListener("click", () => action())
	button.title = text
	button.innerText = text
	return button
}

export const IMG = (url: string): HTMLImageElement => {
	const i = document.createElement("img")
	i.src = url
	return i
}
