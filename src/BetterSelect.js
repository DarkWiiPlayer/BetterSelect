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
	#abortOpen
	#value = {}

	#internals = this.attachInternals()
	static formAssociated = true

	static styleSheet = css`
		:host {
			position: relative;
		}
		* {
			box-sizing: border-box;
		}
		[part="display"] {
			display: inline-flex;
			flex-flow: row nowrap;

			min-width: 20em;

			padding: .4em;

			cursor: pointer;

			:last-child {
				display: block;
				margin-left: auto;
			}
		}
		:not(:empty + *)[name="placeholder"] {
			display: none;
		}
		[part="drop-down"] {
			/* Resets */
			border: unset;
			padding: unset;
			background: inherit;
			color: inherit;

			position: absolute;
			width: 100%;
			flex-flow: column;
			--gap: .4em;
			margin: 0;

			gap: var(--gap);
			padding-top: var(--gap);
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
	`

	constructor() {
		super()
		childObserver.observe(this, {childList: true})
		this.attachShadow({mode: "open"}).innerHTML = `
			<div id="display" part="display">
				<slot name="before"></slot>
				<span part="display-text" id="text"></span>
				<slot name="placeholder" aria-hidden="true"></slot>
				<slot name="after">🔽</slot>
			</div>
			<dialog id="dialog" part="drop-down">
				<input type="search" id="input" part="input" type="text"></input>
				<ul id="list" part="list"></ul>
				<slot name="loading"></slot>
			</dialog>
		`
		this.shadowRoot.adoptedStyleSheets = [BetterSelect.styleSheet]

		this.tabindex = 0

		this.options = this.getElementsByTagName("option")
		for (const element of this.shadowRoot.querySelectorAll(`[id]`)) this[element.id] = element

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

		this.shadowRoot.addEventListener("input", event => {
			const item = event.target.closest("#input")
			if (item) {
				this.search(item.value)
				event.stopPropagation()
			}
		})
		this.addEventListener("focus", event => {
			this.open()
		})
	}

	open() {
		if (this.#abortOpen) return

		this.#abortOpen = new AbortController()

		const signal = this.#abortOpen.signal
		window.addEventListener("click", event => {
			if (!this.contains(event.target)) {
				this.close()
			}
		}, {signal})
		this.addEventListener("keypress", event => {
			if (event.key == "Enter") {
				this.selectDefault()
			}
		}, {signal})

		this.dialog.show()
		this.#internals.states.add("--open")
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

	search(value) {
		for (const item of this.list.children) {
			item.toggleAttribute("hidden", !this.match(value, item))
		}
	}

	selectDefault() {
		const candidates = [...this.list.children].filter(child => !child.hasAttribute("hidden"))
		if (candidates.length) {
			this.setOption(candidates[0])
			this.close()
		}
	}

	match(value, item) {
		return item.innerText.toLowerCase().match(value.toLowerCase())
	}

	connectedCallback() {
		this.setOptions()
	}

	mutationCallback() {
		this.setOptions()
	}

	setOption(option) {
		this.setValue(option.dataset.value, option.innerHTML)
	}

	setValue(value, state=value) {
		this.#value = {value, state}
		this.#internals.setFormValue(value, state)
		this.text.innerText = state
	}

	get value() { return this.#value.value }
	set value(value) {
		for (const option of this.options) {
			if (option.value === value) {
				return this.setOption(option)
			}
		}
		throw `No option with value ${value}`
	}

	get valueText() { return this.#value.state }

	setOptions() {
		this.list.replaceChildren()
		for (const option of this.options) {
			this.list.append(f`<li tab-index="-1" part="item" data-value="${option.value}">${option.innerText}</li>`)
		}
	}
}
