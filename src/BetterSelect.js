/**
 * @param {function} fn
 */
const template = fn => {
	/**
	 * @param {TemplateStringsArray|String} arr
	 * @param {string[]} params
	 */
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

/** Outwards iterator over an element's root nodes across shadow DOM boundaries
 * @param {Element} element
 */
const ancestorRoots = function*(element) {
	while (true) {
		const root = element.getRootNode()
		yield {root,element}
		if (root instanceof ShadowRoot) {
			element = root.host
		} else {
			break
		}
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
	const targets = new Set()
	for (const {target} of mutations) {
		if (target instanceof BetterSelect)
			targets.add(target)
	}
	for (const target of targets)
		target.mutationCallback()
})

export class BetterSelect extends HTMLElement {
	/** @type {AbortController} */
	#abortOpen
	#value = {}

	#internals = this.attachInternals()
	static formAssociated = true
	static observedAttributes = Object.freeze(["placeholder", "search-placeholder", "required"])

	static styleSheet = css`
		:host {
			position: relative;
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
			z-index: var(--layer-dropdown, 100);
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
					<span part="placeholder" id="placeholder" aria-hidden="true"></span>
				</slot>
			</div>
			<dialog id="dialog" part="drop-down">
				<slot name="top"></slot>
				<input type="search" id="input" part="search" type="search"></input>
				<slot name="below-search"></slot>
				<ul id="list" part="list"></ul>
				<slot name="bottom"></slot>
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
			const key = event.key
			if (this.#internals.states.has("--open")) {
				if (key == " " && this.list.contains(this.shadowRoot.activeElement)) {
					this.close()
					event.preventDefault()
					event.stopPropagation()
				} else if (key == "Escape") {
					this.close()
				}
			} else {
				if (key == " ") {
					this.open()
					event.preventDefault()
					event.stopPropagation()
				} else if (key == "Escape") {
					this.keyboardSearchBuffer = ""
					event.preventDefault()
					event.stopPropagation()
				} else if (key == "Backspace") {
					event.preventDefault()
					event.stopPropagation()
				} else if (!event.ctrlKey && !event.altKey && key.match(/^[a-zA-Z0-9]$/)) {
					this.keyboardSearchAppend(key)
					event.preventDefault()
					event.stopPropagation()
				}
			}
		})

		this.shadowRoot.addEventListener("input", event => {
			const item = event.target.closest("#input")
			if (item) {
				this.search(item.value)
				event.stopPropagation()
			}
		})

		this.setValidity()
	}

	/**
	 * @param {String} key
	 */
	keyboardSearchAppend(key) {
		this.searchTimeout?.abort()
		this.searchTimeout = new AbortController()

		const timeout = 1000 * (Number(this.getAttribute("search-timeout")) || 1)
		const ref = setTimeout(()=> {
			this.keyboardSearchBuffer = ""
		}, timeout)
		this.searchTimeout.signal.addEventListener("abort", () => {
			window.clearTimeout(ref)
		})

		this.keyboardSearchBuffer = (this.keyboardSearchBuffer || "") + key

		this.closedSearch(this.keyboardSearchBuffer)
	}

	/**
	 * @param {string} search
	 */
	closedSearch(search) {
		for (const item of this.list.children) {
			if (this.match(search, item)) {
				this.setOption(item)
				return
			}
		}
	}

	async open() {
		if (this.#abortOpen) return

		this.#abortOpen = new AbortController()

		const signal = this.closeSignal

		// Click events don't properly cross shadow-DOM boundaries.
		// Therefore: one event is needed for each nested shadow-DOM
		// in the element's ancestry.
		for (const {root, element} of ancestorRoots(this)) {
			root.addEventListener("click", event => {
				if (event.target instanceof HTMLElement) {
					// This can only happen within the same root as the
					// current element so can be handled trivially
					if (this.contains(event.target)) return

					// On every level, if an event originates from the containing
					// shadow host, it can get ignored, as the corresponding
					// shadow root event handler has already handled it.
					if (event.target == element) return

					// The event target wasn't inside the element
					// nor is indirectly hosting it.
					this.close()
				}
			}, {signal})
		}

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
		return this.setValue(option.dataset.value, option.innerText)
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

		this.setValidity()
	}

	get value() { return this.#value.value }
	set value(value) {
		if (value === undefined) {
			this.clear()
		} else {
			for (const option of Array.from(this.options)) {
				if (option.value === String(value)) {
					this.setValue(option.value, option.innerText)
					return
				}
			}
		}
		throw `No option with value ${value}`
	}

	get valueText() { return this.#value.state }

	setOptions() {
		this.list.replaceChildren()
		for (const option of this.options) {
			this.list.append(f`<li tabindex="0" part="item" data-value="${option.value}">${option.innerText}</li>`)
			if (this.value == undefined && option.selected) {
				this.value = option.value
			}
		}
	}

	/** Changes the placeholder displayed in the display area
	 * @param {string} text
	 */
	placeholderChanged(text) {
		this.placeholder.innerText = text
	}

	/** Changes the placeholder displayed in the search box when the drop-down is open
	 * @param {string} text
	 */
	searchPlaceholderChanged(text) {
		this.input.placeholder = text
	}

	/**
	 * @return {String}
	 */
	get name() { return this.getAttribute("name") }

	/**
	 * @param {String} name
	 */
	set name(name) { this.setAttribute("name", String(name)) }

	get form() { return this.#internals.form }

	clear() {
		this.setValue(undefined, "")
	}

	/**
	 * @param {Boolean} disabled
	 */
	set disabled(disabled) { this.toggleAttribute("disabled", disabled) }
	get disabled() { return this.hasAttribute("disabled") }

	/**
	 * @typedef {"badInput"|"customError"|"patternMismatch"|"rangeOverflow"|"rangeUnderflow"|"stepMismatch"|"tooLong"|"tooShort"|"typeMismatch"|"valid"|"valueMissing"} ValidityConstraint
	 */

	/**
	 * @param {ValidityConstraint} _constraint
	 */
	validityMessage(_constraint) {
		return "Please select an option."
	}


	setValidity() {
		if (this.required) {
			const valid = Boolean(this.value)
			if (valid) {
				this.#internals.setValidity({})
			} else {
				this.#internals.setValidity({valueMissing: true}, this.validityMessage("valueMissing"))
			}
			return valid
		} else {
			this.#internals.setValidity({})
			return true
		}
	}

	checkValidity() { return this.#internals.checkValidity() }

	get validity() { return this.#internals.validity }

	get validationMessage() { return this.#internals.validationMessage }

	get willValidate() { return this.#internals.willValidate }

	/**
	 * @param {Boolean} required
	 */
	set required(required) { this.toggleAttribute("required", required) }
	get required() { return this.hasAttribute("required") }

	reportValidity() { return this.#internals.reportValidity() }

	requiredChanged() { this.setValidity() }

	/**
	 * @param {String} name
	 * @param {String} before
	 * @param {String} after
	 */
	attributeChangedCallback(name, before, after) {
		const methodName = name.replace(/-([a-z])/g, (_all, letter) => (letter.toUpperCase())) + "Changed"
		if (methodName in this) this[methodName](after, before)
	}
}
