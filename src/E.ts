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
	if (id) d.id = id.replace("#", "")
	for (let i = 0; i < elements.length; i++) {
		const e = elements[i]
		d.appendChild(e)
	}
	return d
}
