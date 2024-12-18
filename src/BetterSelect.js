const template = fn => {
	return (arr, ...params) => {
		if (arr instanceof Array) {
			const buffer = []
			for (let i = 0; i < params.length; i++) {
				buffer.push(arr[i])
				buffer.push(params[i])
			}
			buffer.push(arr[arr.length - 1])
			return fn(buffer.join(""))
		}
		return fn(arr)
	}
}

const f = template(string => {
	const template = document.createElement("template")
	template.innerHTML = string
	return template.content
})

const css = template(string => {
	const styleSheet = new CSSStyleSheet
	styleSheet.replaceSync(string)
	return styleSheet
})

const childObserver = new MutationObserver(mutations => {
	for (const mutation of mutations) {
		mutation.target.mutationCallback()
	}
})

export class BetterSelect extends HTMLElement {
	/** @type {AbortController} */
	#abortOpen
	#value = {}

	#internals = this.attachInternals()
	static formAssociated = true

	static styleSheet = css`
		:host {
			position: relative;
			z-index: 100;
			display: inline-block;
		}
		* {
			box-sizing: border-box;
		}
		[part="display"] {
			min-width: 100%;

			/* Layout */
			align-items: center;
			display: inline-flex;
			flex-flow: row nowrap;

			/* Styling */
			cursor: pointer;
		}
		[part="display-text"]:empty {
			display: none;
		}
		:not(:empty + *)[name="placeholder"] {
			display: none;
		}
		[part="drop-down"], [part="item"] {
			/* Resets */
			border: unset;
			outline: unset;
			padding: unset;
		}
		[part="drop-down"] {
			background: inherit;
			color: inherit;

			position: absolute;
			flex-flow: column;
			margin: 0;
		}
		[part="drop-down"]:modal {
			margin: auto;
			&::backdrop {
				background-color: #fff2;
				backdrop-filter: blur(2px);
			}
		}
		[part="drop-down"][open] {
			display: flex;
		}
		[part="list"] {
			display: contents;
		}
		[part="item"] {
			display: block;
			cursor: pointer;
			white-space: nowrap;
		}
		[part="item"]:focus {
			font-weight: bold;
		}
		[part="item"][hidden] {
			display: none;
		}
		slot[name="loading"] {
			display: none;
		}
		:host(:state(--loading)) {
			[part="list"] { display: none; }
			slot[name="loading"] { display: block; }
		}
	`

	/** @type {HTMLElement} */
	display
	/** @type {HTMLElement} */
	text
	/** @type {HTMLElement} */
	list
	/** @type {HTMLElement} */
	placeholder
	/** @type {HTMLInputElement} */
	input
	/** @type {HTMLDialogElement} */
	dialog
	/** @type {HTMLDialogElement} */
	loading

	constructor() {
		super()
		childObserver.observe(this, {childList: true})
		this.attachShadow({mode: "open"}).innerHTML = `
			<div id="display" part="display">
				<span part="display-text" id="text"></span>
				<slot name="placeholder" aria-hidden="true">
					<span id="placeholder" aria-hidden="true"></span>
				</slot>
			</div>
			<dialog id="dialog" part="drop-down">
				<input type="search" id="input" part="search" type="text"></input>
				<ul id="list" part="list"></ul>
				<slot id="loading" name="loading"></slot>
			</dialog>
		`
		this.shadowRoot.adoptedStyleSheets = [BetterSelect.styleSheet]
		this.#internals.setFormValue("", "")

		this.tabIndex = 0

		this.#internals.role = "combobox"

		this.options = this.getElementsByTagName("option")
		for (const element of this.shadowRoot.querySelectorAll(`[id]`)) {
			this[element.id] = element
		}

		this.shadowRoot.addEventListener("click", event => {
			const item = event.target.closest("#list > li")
			if (item) {
				this.setOption(item)
				this.dispatchEvent(new InputEvent("input", {bubbles: true}))
				this.close()
			} else if (!this.#internals.states.has("--open")) {
				this.open()
			} else if (this.display.contains(event.target) || this.display.contains(event.target.closest("[slot]")?.assignedSlot)) {
				this.close()
			}
		})

		this.addEventListener("keydown", event => {
			if (event.key == " " && !this.input.contains(this.shadowRoot.activeElement)) {
				if (this.#internals.states.has("--open")) {
					this.close()
				} else {
					this.open()
				}
			} else if (event.key == "Escape") {
				this.close()
			}
		})

		this.shadowRoot.addEventListener("input", event => {
			const item = event.target.closest("#input")
			if (item) {
				this.search(item.value)
				event.stopPropagation()
			}
		})
	}

	async open() {
		if (this.#abortOpen) return

		this.#abortOpen = new AbortController()

		const signal = this.closeSignal
		window.addEventListener("click", event => {
			if (event.target instanceof HTMLElement && !this.contains(event.target)) {
				this.close()
			}
		}, {signal})
		this.addEventListener("keypress", event => {
			if (event.key == "Enter") {
				this.selectDefault()
				this.dispatchEvent(new InputEvent("input", {bubbles: true}))
			}
		}, {signal})

		this.dialog.show()
		this.#internals.states.add("--open")

		if ("populate" in this) {
			this.#internals.states.add("--loading")
			await this.populate()
			this.#internals.states.delete("--loading")
		}
	}

	close() {
		this.input.value = null
		for (const hidden of this.list.querySelectorAll("[hidden]"))
			hidden.removeAttribute("hidden")
		this.#abortOpen?.abort()
		this.#abortOpen = null
		this.#internals.states.delete("--open")
		this.dialog.close()
	}

	get closeSignal() { return this.#abortOpen?.signal }

	/** @param {String} value */
	search(value) {
		for (const item of this.list.children) {
			item.toggleAttribute("hidden", !this.match(value, item))
		}
	}

	selectDefault() {
		if (this.shadowRoot.activeElement?.matches(`[part="item"]`)) {
			this.setOption(this.shadowRoot.activeElement)
			this.close()
			return
		}
		const candidates = [...this.list.children].filter(child => !child.hasAttribute("hidden"))
		if (candidates.length) {
			this.setOption(candidates[0])
			this.close()
		}
	}

	/**
	 * @param {string} value
	 * @param {HTMLElement} item
	 */
	match(value, item) {
		return item.innerText.toLowerCase().match(value.toLowerCase())
	}

	connectedCallback() {
		this.setOptions()
	}

	mutationCallback() {
		this.setOptions()
	}

	/** @param {HTMLElement} option */
	setOption(option) {
		this.setValue(option.dataset.value, option.innerHTML)
	}

	/**
	 * @param {string} value
	 * @param {string} state
	 */
	setValue(value, state=value) {
		this.#value = {value, state}
		this.dispatchEvent(new Event("change", {bubbles: true}));
		this.#internals.setFormValue(value, state)
		this.text.innerText = state
	}

	get value() { return this.#value.value }
	set value(value) {
		for (const option of this.options) {
			if (option.value === value) {
				this.setOption(option)
				return
			}
		}
		throw `No option with value ${value}`
	}

	get valueText() { return this.#value.state }

	setOptions() {
		this.list.replaceChildren()
		for (const option of this.options) {
			this.list.append(f`<li tabindex="0" part="item" data-value="${option.value}">${option.innerText}</li>`)
		}
	}
}
